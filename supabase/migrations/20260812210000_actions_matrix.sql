-- Standalone actions prioritized by impact versus effort.
create table if not exists public.acoes_avulsas (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  area text not null check (area in ('Clínica', 'Mentoria', 'Pessoal')),
  impacto integer not null check (impacto between 0 and 10),
  esforco integer not null check (esforco between 0 and 10),
  prazo date,
  concluida boolean not null default false,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists acoes_avulsas_priority_idx on public.acoes_avulsas (concluida, impacto desc, esforco asc);
alter table public.acoes_avulsas enable row level security;
drop policy if exists "members manage standalone actions" on public.acoes_avulsas;
create policy "members manage standalone actions" on public.acoes_avulsas for all to authenticated
  using (public.is_active_member()) with check (public.is_active_member());
drop trigger if exists acoes_avulsas_set_updated_at on public.acoes_avulsas;
create trigger acoes_avulsas_set_updated_at before update on public.acoes_avulsas
  for each row execute function public.tg_set_updated_at();
