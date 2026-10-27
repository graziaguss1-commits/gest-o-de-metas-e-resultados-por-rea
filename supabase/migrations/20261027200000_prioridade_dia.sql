-- Uma prioridade por DIA, no lugar de tres por semana.
--
-- O top 3 semanal vivia em planejamento_semanal.priority_ids e apontava para
-- plano_tarefas. Isso excluia acao avulsa e compromisso, que tambem podem ser
-- a coisa mais importante do dia. Aqui a chave e a referencia do bloco, no
-- mesmo formato de bloco_motivos (ag:/av:/cp:<id>@<data original>), entao
-- qualquer uma das tres origens pode ser a prioridade.
--
-- UNIQUE (user_id, data) e a regra do produto virando regra do banco: uma so.
-- Trocar de prioridade e um upsert, nao uma lista que cresce.
--
-- Dia sem linha e estado normal, nao pendencia: ela escolhe a de hoje, e
-- amanha escolhe a de amanha. Nada no app deve cobrar os dias vazios.
--
-- priority_ids continua na tabela de planejamento, sem uso. Nao apago coluna
-- com historico dela dentro so para limpar.

CREATE TABLE IF NOT EXISTS public.prioridade_dia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  data date NOT NULL,
  referencia text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prioridade_dia_uma_por_dia UNIQUE (user_id, data),
  CONSTRAINT prioridade_dia_referencia CHECK (referencia ~ '^(ag|av|cp):')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prioridade_dia TO authenticated;
GRANT ALL ON public.prioridade_dia TO service_role;

ALTER TABLE public.prioridade_dia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own prioridade select" ON public.prioridade_dia;
DROP POLICY IF EXISTS "own prioridade insert" ON public.prioridade_dia;
DROP POLICY IF EXISTS "own prioridade update" ON public.prioridade_dia;
DROP POLICY IF EXISTS "own prioridade delete" ON public.prioridade_dia;
CREATE POLICY "own prioridade select" ON public.prioridade_dia FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own prioridade insert" ON public.prioridade_dia FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own prioridade update" ON public.prioridade_dia FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own prioridade delete" ON public.prioridade_dia FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS prioridade_dia_user_data_idx ON public.prioridade_dia (user_id, data);

DROP TRIGGER IF EXISTS set_updated_at_prioridade_dia ON public.prioridade_dia;
CREATE TRIGGER set_updated_at_prioridade_dia BEFORE UPDATE ON public.prioridade_dia
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
