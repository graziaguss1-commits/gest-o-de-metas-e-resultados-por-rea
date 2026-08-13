ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS metric_type text;

UPDATE public.metas
SET metric_type = CASE
  WHEN btrim(unidade) IN ('R$','r$','BRL','brl') THEN 'financeiro'
  WHEN btrim(unidade) = '%' THEN 'percentual'
  WHEN lower(btrim(unidade)) IN ('etapas','etapa') THEN 'projeto'
  WHEN lower(btrim(unidade)) IN ('horas','hora','dias','dia','minutos','minuto') THEN 'tempo'
  WHEN lower(btrim(unidade)) LIKE '%por semana%' OR lower(btrim(unidade)) LIKE '%por mes%' OR lower(btrim(unidade)) LIKE '%por mês%' OR lower(btrim(unidade)) LIKE '%por dia%' THEN 'habito'
  ELSE 'quantidade'
END
WHERE metric_type IS NULL;

ALTER TABLE public.metas ALTER COLUMN metric_type SET DEFAULT 'quantidade';
ALTER TABLE public.metas ALTER COLUMN metric_type SET NOT NULL;

ALTER TABLE public.metas DROP CONSTRAINT IF EXISTS metas_metric_type_check;
ALTER TABLE public.metas ADD CONSTRAINT metas_metric_type_check
  CHECK (metric_type IN ('quantidade','financeiro','percentual','projeto','habito','tempo'));

DROP VIEW IF EXISTS public.metas_with_responsavel;
CREATE VIEW public.metas_with_responsavel AS
SELECT m.id,
    m.nome,
    m.descricao,
    m.area,
    m.responsavel_id,
    m.valor_alvo,
    m.valor_atual,
    m.unidade,
    m.periodicidade,
    m.data_inicio,
    m.data_fim,
    m.status,
    m.is_inverse,
    m.is_demo,
    m.criado_por,
    m.created_at,
    m.updated_at,
    m.metric_type,
    p.full_name AS responsavel_nome,
    p.avatar_url AS responsavel_avatar,
    p.email AS responsavel_email
   FROM public.metas m
     LEFT JOIN public.profiles p ON p.id = m.responsavel_id;