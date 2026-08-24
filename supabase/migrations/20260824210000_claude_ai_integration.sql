-- Claude (Anthropic) integration.
-- API keys stay encrypted in Supabase Vault and are only decrypted for
-- service-role Edge Functions. The application stores usage metadata, never
-- prompts, responses or secret values.

create table if not exists public.ai_execucoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meta_id uuid references public.metas(id) on delete set null,
  provider text not null,
  model text not null,
  recurso text not null,
  status text not null check (status in ('sucesso', 'erro')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  custo_estimado_usd numeric(14, 8) not null default 0 check (custo_estimado_usd >= 0),
  erro text,
  created_at timestamptz not null default now()
);

create index if not exists ai_execucoes_user_created_idx
  on public.ai_execucoes (user_id, created_at desc);

create index if not exists ai_execucoes_recurso_created_idx
  on public.ai_execucoes (recurso, created_at desc);

alter table public.ai_execucoes enable row level security;

drop policy if exists "Users read own AI executions" on public.ai_execucoes;
create policy "Users read own AI executions"
  on public.ai_execucoes
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Admins read AI executions" on public.ai_execucoes;
create policy "Admins read AI executions"
  on public.ai_execucoes
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

revoke all on table public.ai_execucoes from anon;
revoke insert, update, delete on table public.ai_execucoes from authenticated;
grant select on table public.ai_execucoes to authenticated;
grant all on table public.ai_execucoes to service_role;

-- API integrations are organization-wide and may only be managed by admins.
drop policy if exists "Users manage own keys" on public.api_keys_registry;
drop policy if exists "Admins manage own API keys" on public.api_keys_registry;
create policy "Admins manage own API keys"
  on public.api_keys_registry
  for all
  to authenticated
  using (
    auth.uid() = user_id
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  with check (
    auth.uid() = user_id
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Store the key and its registry entry atomically. The deterministic Vault
-- name lets a later save replace the old value instead of creating copies.
create or replace function public.store_own_api_key(
  p_service_name text,
  p_secret_value text,
  p_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_service text := lower(trim(p_service_name));
  v_secret_name text;
  v_secret_id uuid;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Apenas administradores podem configurar integrações de IA';
  end if;

  if v_service <> 'anthropic' then
    raise exception 'Serviço de IA não suportado';
  end if;

  if nullif(trim(p_secret_value), '') is null then
    raise exception 'A chave de API é obrigatória';
  end if;

  v_secret_name := 'api_key_' || auth.uid()::text || '_' || v_service;

  select id
    into v_secret_id
    from vault.secrets
   where name = v_secret_name
   limit 1;

  if v_secret_id is null then
    select vault.create_secret(trim(p_secret_value), v_secret_name)
      into v_secret_id;
  else
    perform vault.update_secret(v_secret_id, trim(p_secret_value), v_secret_name);
  end if;

  insert into public.api_keys_registry (
    user_id,
    service_name,
    vault_secret_id,
    label,
    is_active,
    updated_at
  )
  values (
    auth.uid(),
    v_service,
    v_secret_id,
    coalesce(nullif(trim(p_label), ''), 'Claude (Anthropic)'),
    true,
    now()
  )
  on conflict (user_id, service_name)
  do update set
    vault_secret_id = excluded.vault_secret_id,
    label = excluded.label,
    is_active = true,
    updated_at = now();

  return v_secret_id;
end;
$$;

revoke execute on function public.store_own_api_key(text, text, text) from public, anon;
grant execute on function public.store_own_api_key(text, text, text) to authenticated;

-- Remove the registry entry and encrypted Vault value in the same transaction.
create or replace function public.delete_own_api_key(p_service_name text)
returns boolean
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_service text := lower(trim(p_service_name));
  v_secret_id uuid;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Apenas administradores podem remover integrações de IA';
  end if;

  delete from public.api_keys_registry
   where user_id = auth.uid()
     and service_name = v_service
  returning vault_secret_id into v_secret_id;

  if v_secret_id is null then
    return false;
  end if;

  delete from vault.secrets where id = v_secret_id;
  return true;
end;
$$;

revoke execute on function public.delete_own_api_key(text) from public, anon;
grant execute on function public.delete_own_api_key(text) to authenticated;

-- Read one admin's key for the validation endpoint. Only service-role Edge
-- Functions can execute this function.
create or replace function public.read_user_api_key(
  p_user_id uuid,
  p_service_name text
)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_value text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Acesso restrito ao backend';
  end if;

  select decrypted.decrypted_secret
    into v_value
    from public.api_keys_registry registry
    join vault.decrypted_secrets decrypted
      on decrypted.id = registry.vault_secret_id
   where registry.user_id = p_user_id
     and registry.service_name = lower(trim(p_service_name))
   limit 1;

  return v_value;
end;
$$;

revoke execute on function public.read_user_api_key(uuid, text) from public, anon, authenticated;
grant execute on function public.read_user_api_key(uuid, text) to service_role;

-- Resolve the latest active organization key. The owner id lets the backend
-- deactivate only the failing registry entry if Anthropic revokes the key.
create or replace function public.resolve_active_api_key(p_service_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Acesso restrito ao backend';
  end if;

  select jsonb_build_object(
           'owner_id', registry.user_id,
           'api_key', decrypted.decrypted_secret
         )
    into v_result
    from public.api_keys_registry registry
    join vault.decrypted_secrets decrypted
      on decrypted.id = registry.vault_secret_id
   where registry.service_name = lower(trim(p_service_name))
     and coalesce(registry.is_active, true)
   order by registry.updated_at desc nulls last
   limit 1;

  return v_result;
end;
$$;

revoke execute on function public.resolve_active_api_key(text) from public, anon, authenticated;
grant execute on function public.resolve_active_api_key(text) to service_role;

-- Legacy generic reader is no longer callable from the browser. Existing
-- backend integrations continue to work with service_role.
revoke execute on function public.read_vault_secret(text) from authenticated;
grant execute on function public.read_vault_secret(text) to service_role;

