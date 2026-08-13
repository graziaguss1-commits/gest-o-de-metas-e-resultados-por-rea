-- 1. Planos de ação mensuráveis (nível tarefa)
ALTER TABLE public.plano_tarefas
  ADD COLUMN IF NOT EXISTS frequencia text NOT NULL DEFAULT 'unica',
  ADD COLUMN IF NOT EXISTS quantidade_planejada numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unidade text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS data_inicio date,
  ADD COLUMN IF NOT EXISTS data_fim date,
  ADD COLUMN IF NOT EXISTS impacto integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS esforco integer NOT NULL DEFAULT 5;

ALTER TABLE public.plano_tarefas
  DROP CONSTRAINT IF EXISTS plano_tarefas_frequencia_check;
ALTER TABLE public.plano_tarefas
  ADD CONSTRAINT plano_tarefas_frequencia_check
  CHECK (frequencia IN ('unica','diaria','semanal','mensal'));

-- 2. Execução registrada por período/data
CREATE TABLE IF NOT EXISTS public.tarefa_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.plano_tarefas(id) ON DELETE CASCADE,
  data_referencia date NOT NULL,
  quantidade numeric NOT NULL DEFAULT 0,
  observacao text,
  registrado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tarefa_execucoes_tarefa_idx ON public.tarefa_execucoes(tarefa_id, data_referencia);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefa_execucoes TO authenticated;
GRANT ALL ON public.tarefa_execucoes TO service_role;
ALTER TABLE public.tarefa_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read execucoes" ON public.tarefa_execucoes
  FOR SELECT TO authenticated USING (public.is_active_member());
CREATE POLICY "members insert execucoes" ON public.tarefa_execucoes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member() AND registrado_por = auth.uid());
CREATE POLICY "owners update execucoes" ON public.tarefa_execucoes
  FOR UPDATE TO authenticated
  USING (public.is_active_member() AND (registrado_por = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role)))
  WITH CHECK (public.is_active_member());
CREATE POLICY "owners delete execucoes" ON public.tarefa_execucoes
  FOR DELETE TO authenticated
  USING (public.is_active_member() AND (registrado_por = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role)));

CREATE TRIGGER tarefa_execucoes_set_updated_at
  BEFORE UPDATE ON public.tarefa_execucoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. Funil opcional por meta
ALTER TABLE public.metas
  ADD COLUMN IF NOT EXISTS funil_ativo boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.meta_funil_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id uuid NOT NULL REFERENCES public.metas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meta_funil_etapas_meta_idx ON public.meta_funil_etapas(meta_id, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_funil_etapas TO authenticated;
GRANT ALL ON public.meta_funil_etapas TO service_role;
ALTER TABLE public.meta_funil_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read funil" ON public.meta_funil_etapas
  FOR SELECT TO authenticated USING (public.is_active_member());
CREATE POLICY "members write funil" ON public.meta_funil_etapas
  FOR ALL TO authenticated USING (public.is_active_member()) WITH CHECK (public.is_active_member());

CREATE TRIGGER meta_funil_etapas_set_updated_at
  BEFORE UPDATE ON public.meta_funil_etapas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4. View atualizada (coluna nova no final, sem quebrar consumidores)
CREATE OR REPLACE VIEW public.metas_with_responsavel AS
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
    p.email AS responsavel_email,
    m.funil_ativo
   FROM public.metas m
     LEFT JOIN public.profiles p ON p.id = m.responsavel_id;