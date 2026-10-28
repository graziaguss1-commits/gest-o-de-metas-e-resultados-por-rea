-- Meta de aderencia semanal das metas de habito.
--
-- O grafico de barras semanais desenha uma linha de referencia nesse valor e
-- o status do habito usa o mesmo numero como corte. Fica na meta, e nao no
-- codigo, porque o patamar razoavel muda de habito para habito: 80% de um
-- treino nao e a mesma exigencia que 80% de uma leitura diaria.
alter table metas add column if not exists meta_aderencia smallint not null default 80
  check (meta_aderencia between 1 and 100);

comment on column metas.meta_aderencia is
  'Meta de aderencia semanal (%) das metas de habito: linha de referencia do grafico e corte do status.';

-- A view precisa listar a coluna nova: view criada com lista explicita nao
-- aprende colunas sozinha.
--
-- O `security_invoker = true` nao e detalhe: sem ele a view roda com os
-- privilegios de quem a criou e passa por cima do RLS de `metas` — todo
-- mundo passaria a enxergar as metas de todo mundo.
create or replace view public.metas_with_responsavel
with (security_invoker = true) as
 SELECT m.id, m.nome, m.descricao, m.area, m.responsavel_id, m.valor_alvo, m.valor_atual,
    m.unidade, m.periodicidade, m.data_inicio, m.data_fim, m.status, m.is_inverse, m.is_demo,
    m.criado_por, m.created_at, m.updated_at, m.metric_type,
    p.full_name AS responsavel_nome, p.avatar_url AS responsavel_avatar, p.email AS responsavel_email,
    m.funil_ativo, m.arquivada_em, m.meta_aderencia
   FROM metas m LEFT JOIN profiles p ON p.id = m.responsavel_id;
