-- Arquivar meta: tirar do painel sem perder nada.
--
-- O app nao tinha como remover uma meta da frente. A saida obvia — apagar —
-- levaria junto lancamentos de resultado, comentarios e funil, por causa dos
-- ON DELETE CASCADE. Para uma meta que acabou, isso e perder o historico
-- justamente de uma coisa que terminou.
--
-- arquivada_em e nulo enquanto a meta esta ativa. Data em vez de booleano
-- porque saber QUANDO saiu do painel custa o mesmo e responde mais.
--
-- Plano de meta arquivada some junto, mas isso e DERIVADO da meta, sem marca
-- no plano: um segundo lugar guardando "arquivado" sairia do ar na primeira
-- vez que alguem desarquivasse a meta e esquecesse os planos.

ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS arquivada_em timestamptz;

-- A view ganha a coluna. security_invoker = true e obrigatorio aqui: sem
-- ele a view passa por cima do RLS de metas e todo mundo enxerga as metas
-- de todo mundo.
DROP VIEW IF EXISTS public.metas_with_responsavel;
CREATE VIEW public.metas_with_responsavel
WITH (security_invoker = true) AS
 SELECT m.id, m.nome, m.descricao, m.area, m.responsavel_id, m.valor_alvo,
    m.valor_atual, m.unidade, m.periodicidade, m.data_inicio, m.data_fim,
    m.status, m.is_inverse, m.is_demo, m.criado_por, m.created_at,
    m.updated_at, m.metric_type,
    p.full_name AS responsavel_nome, p.avatar_url AS responsavel_avatar,
    p.email AS responsavel_email, m.funil_ativo,
    m.arquivada_em
   FROM public.metas m
     LEFT JOIN public.profiles p ON p.id = m.responsavel_id;

GRANT SELECT ON public.metas_with_responsavel TO authenticated;
