-- A política anterior chamava can_access_plan(id), que consultava a própria
-- tabela. Durante INSERT ... RETURNING, a nova linha ainda não ficava visível
-- para essa subconsulta e o PostgreSQL cancelava a criação por RLS.
-- Avaliar os campos da própria linha permite devolver o plano recém-criado
-- sem ampliar o acesso a planos privados.
drop policy if exists "participants read planos" on public.planos_acao;

create policy "participants read planos" on public.planos_acao
  for select to authenticated
  using (
    public.is_active_member()
    and (
      (
        meta_id is not null
        and public.is_meta_responsavel(meta_id, auth.uid())
      )
      or (
        meta_id is null
        and criado_por = auth.uid()
      )
    )
  );

comment on policy "participants read planos" on public.planos_acao is
  'Permite ler e retornar planos próprios ou vinculados a metas sob responsabilidade do usuário.';
