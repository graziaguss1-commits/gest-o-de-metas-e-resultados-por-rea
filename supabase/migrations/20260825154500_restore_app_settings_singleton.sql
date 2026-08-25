-- Restaura a configuração global caso uma limpeza de dados tenha removido
-- acidentalmente o registro singleton usado pelo aplicativo.
insert into public.app_settings (id, capacidade_diaria_minutos)
values (1, 720)
on conflict (id) do nothing;

-- O frontend usa UPSERT para que o registro possa se autorrecuperar.
-- Somente administradores ativos podem criar novamente o singleton.
drop policy if exists "admins insert settings" on public.app_settings;
create policy "admins insert settings" on public.app_settings
  for insert to authenticated
  with check (
    id = 1
    and public.is_active_member()
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  );

comment on policy "admins insert settings" on public.app_settings is
  'Permite que um administrador ativo restaure o registro singleton de configurações.';
