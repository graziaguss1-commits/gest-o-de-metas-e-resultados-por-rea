-- MetasIA — Sprint 1 foundation
-- Single-tenant model: RLS gates by authenticated + approved profile.
-- Sensitive secrets (Slack webhook, Google Sheets token) go to vault via wrappers.

-- ============================================================================
-- VAULT WRAPPERS (used by app_settings + edge functions)
-- ============================================================================

create or replace function public.store_vault_secret(p_key text, p_value text)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_existing_id uuid;
  v_secret_id uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Apenas admins podem armazenar secrets';
  end if;

  select id into v_existing_id from vault.secrets where name = p_key;

  if v_existing_id is null then
    select vault.create_secret(p_value, p_key) into v_secret_id;
    return v_secret_id;
  else
    perform vault.update_secret(v_existing_id, p_value, p_key);
    return v_existing_id;
  end if;
end;
$$;

revoke execute on function public.store_vault_secret(text, text) from public, anon;
grant execute on function public.store_vault_secret(text, text) to authenticated;

create or replace function public.read_vault_secret(p_key text)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_value text;
begin
  -- Only admins (or edge functions with service_role) may read secrets.
  if auth.role() <> 'service_role' and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Apenas admins podem ler secrets';
  end if;

  select decrypted_secret into v_value
  from vault.decrypted_secrets
  where name = p_key
  limit 1;

  return v_value;
end;
$$;

revoke execute on function public.read_vault_secret(text) from public, anon;
grant execute on function public.read_vault_secret(text) to authenticated, service_role;

-- ============================================================================
-- STATUS CALCULATION FUNCTION
-- ============================================================================

create or replace function public.calcular_status_meta(
  p_valor_atual numeric,
  p_valor_alvo numeric,
  p_data_inicio date,
  p_data_fim date,
  p_is_inverse boolean default false
)
returns text
language plpgsql
immutable
as $$
declare
  v_dias_total integer;
  v_dias_decorridos integer;
  v_progresso_esperado numeric;
  v_progresso_real numeric;
  v_desvio numeric;
begin
  v_dias_total := (p_data_fim - p_data_inicio);
  if v_dias_total <= 0 then
    return 'verde';
  end if;

  v_dias_decorridos := (current_date - p_data_inicio);
  v_progresso_esperado := least(greatest(v_dias_decorridos::numeric / v_dias_total::numeric, 0), 1);

  if p_is_inverse then
    -- menor é melhor: progresso = quanto reduzimos em relação ao alvo (assumindo alvo é o teto desejado)
    if p_valor_alvo = 0 then
      v_progresso_real := case when p_valor_atual = 0 then 1 else 0 end;
    else
      v_progresso_real := greatest(0, 1 - (p_valor_atual / p_valor_alvo));
    end if;
  else
    if p_valor_alvo = 0 then
      v_progresso_real := 1;
    else
      v_progresso_real := p_valor_atual / p_valor_alvo;
    end if;
  end if;

  if v_progresso_esperado = 0 then
    return 'verde';
  end if;

  v_desvio := (v_progresso_real - v_progresso_esperado) / v_progresso_esperado;

  if v_desvio >= -0.05 then
    return 'verde';
  elsif v_desvio >= -0.20 then
    return 'amarelo';
  else
    return 'vermelho';
  end if;
end;
$$;

revoke execute on function public.calcular_status_meta(numeric, numeric, date, date, boolean) from public, anon;
grant execute on function public.calcular_status_meta(numeric, numeric, date, date, boolean) to authenticated;

-- ============================================================================
-- HELPER: is the current user an active+approved authenticated user?
-- Single-tenant gate used by RLS policies.
-- ============================================================================

create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_active = true
      and is_approved = true
  );
$$;

revoke execute on function public.is_active_member() from public, anon;
grant execute on function public.is_active_member() to authenticated;

-- ============================================================================
-- METAS
-- ============================================================================

create table if not exists public.metas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  area text not null,
  responsavel_id uuid references auth.users(id) on delete set null,
  valor_alvo numeric not null,
  valor_atual numeric not null default 0,
  unidade text not null,
  periodicidade text not null check (periodicidade in ('mensal', 'trimestral', 'anual')),
  data_inicio date not null,
  data_fim date not null,
  status text not null default 'verde' check (status in ('verde', 'amarelo', 'vermelho')),
  is_inverse boolean not null default false,
  is_demo boolean not null default false,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists metas_area_idx on public.metas (area);
create index if not exists metas_status_idx on public.metas (status);
create index if not exists metas_responsavel_idx on public.metas (responsavel_id);

alter table public.metas enable row level security;

drop policy if exists "members read metas" on public.metas;
create policy "members read metas" on public.metas
  for select to authenticated
  using (public.is_active_member());

drop policy if exists "members insert metas" on public.metas;
create policy "members insert metas" on public.metas
  for insert to authenticated
  with check (public.is_active_member());

drop policy if exists "members update metas" on public.metas;
create policy "members update metas" on public.metas
  for update to authenticated
  using (public.is_active_member())
  with check (public.is_active_member());

drop policy if exists "admins delete metas" on public.metas;
create policy "admins delete metas" on public.metas
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists metas_set_updated_at on public.metas;
create trigger metas_set_updated_at
  before update on public.metas
  for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- META_LANCAMENTOS
-- ============================================================================

create table if not exists public.meta_lancamentos (
  id uuid primary key default gen_random_uuid(),
  meta_id uuid not null references public.metas(id) on delete cascade,
  valor numeric not null,
  data_lancamento date not null,
  observacao text,
  lancado_por uuid references auth.users(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists meta_lancamentos_meta_idx on public.meta_lancamentos (meta_id, data_lancamento desc);

alter table public.meta_lancamentos enable row level security;

drop policy if exists "members read lancamentos" on public.meta_lancamentos;
create policy "members read lancamentos" on public.meta_lancamentos
  for select to authenticated
  using (public.is_active_member());

drop policy if exists "members insert lancamentos" on public.meta_lancamentos;
create policy "members insert lancamentos" on public.meta_lancamentos
  for insert to authenticated
  with check (public.is_active_member() and lancado_por = auth.uid());

drop policy if exists "admins delete lancamentos" on public.meta_lancamentos;
create policy "admins delete lancamentos" on public.meta_lancamentos
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- META_COMENTARIOS
-- ============================================================================

create table if not exists public.meta_comentarios (
  id uuid primary key default gen_random_uuid(),
  meta_id uuid not null references public.metas(id) on delete cascade,
  autor_id uuid references auth.users(id) on delete set null,
  conteudo text not null,
  created_at timestamptz not null default now()
);

create index if not exists meta_comentarios_meta_idx on public.meta_comentarios (meta_id, created_at desc);

alter table public.meta_comentarios enable row level security;

drop policy if exists "members read comentarios" on public.meta_comentarios;
create policy "members read comentarios" on public.meta_comentarios
  for select to authenticated
  using (public.is_active_member());

drop policy if exists "members insert comentarios" on public.meta_comentarios;
create policy "members insert comentarios" on public.meta_comentarios
  for insert to authenticated
  with check (public.is_active_member() and autor_id = auth.uid());

drop policy if exists "admins delete comentarios" on public.meta_comentarios;
create policy "admins delete comentarios" on public.meta_comentarios
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- PLANOS_ACAO
-- ============================================================================

create table if not exists public.planos_acao (
  id uuid primary key default gen_random_uuid(),
  meta_id uuid references public.metas(id) on delete set null,
  titulo text not null,
  criado_por uuid references auth.users(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planos_acao_meta_idx on public.planos_acao (meta_id);

alter table public.planos_acao enable row level security;

drop policy if exists "members read planos" on public.planos_acao;
create policy "members read planos" on public.planos_acao
  for select to authenticated
  using (public.is_active_member());

drop policy if exists "members write planos" on public.planos_acao;
create policy "members write planos" on public.planos_acao
  for all to authenticated
  using (public.is_active_member())
  with check (public.is_active_member());

drop trigger if exists planos_acao_set_updated_at on public.planos_acao;
create trigger planos_acao_set_updated_at
  before update on public.planos_acao
  for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- PLANO_TAREFAS
-- ============================================================================

create table if not exists public.plano_tarefas (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references public.planos_acao(id) on delete cascade,
  descricao text not null,
  responsavel_id uuid references auth.users(id) on delete set null,
  prazo date,
  concluida boolean not null default false,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists plano_tarefas_plano_idx on public.plano_tarefas (plano_id, ordem);

alter table public.plano_tarefas enable row level security;

drop policy if exists "members read tarefas" on public.plano_tarefas;
create policy "members read tarefas" on public.plano_tarefas
  for select to authenticated
  using (public.is_active_member());

drop policy if exists "members write tarefas" on public.plano_tarefas;
create policy "members write tarefas" on public.plano_tarefas
  for all to authenticated
  using (public.is_active_member())
  with check (public.is_active_member());

-- ============================================================================
-- APP_SETTINGS (singleton — id = 1)
-- ============================================================================

create table if not exists public.app_settings (
  id integer primary key check (id = 1),
  slack_webhook_configured boolean not null default false,
  slack_alerts_enabled boolean not null default false,
  slack_desvio_threshold integer not null default 15 check (slack_desvio_threshold in (10,15,20,25)),
  slack_resumo_semanal boolean not null default true,
  gsheets_configured boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "members read settings" on public.app_settings;
create policy "members read settings" on public.app_settings
  for select to authenticated
  using (public.is_active_member());

drop policy if exists "admins update settings" on public.app_settings;
create policy "admins update settings" on public.app_settings
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- VIEW: metas_with_responsavel (join with profile for UI convenience)
-- ============================================================================

drop view if exists public.metas_with_responsavel cascade;
create view public.metas_with_responsavel
with (security_invoker = true)
as
select
  m.*,
  p.full_name as responsavel_nome,
  p.avatar_url as responsavel_avatar,
  p.email as responsavel_email
from public.metas m
left join public.profiles p on p.id = m.responsavel_id;
