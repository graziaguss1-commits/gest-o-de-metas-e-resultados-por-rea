CREATE TABLE IF NOT EXISTS public.planejamento_semanal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  semana_inicio date NOT NULL,
  priority_ids text[] NOT NULL DEFAULT '{}',
  complementary_ids text[] NOT NULL DEFAULT '{}',
  foco text NOT NULL DEFAULT '',
  wins text NOT NULL DEFAULT '',
  pending text NOT NULL DEFAULT '',
  lesson text NOT NULL DEFAULT '',
  saved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planejamento_semanal_user_semana_key UNIQUE (user_id, semana_inicio),
  CONSTRAINT planejamento_semanal_segunda CHECK (extract(isodow from semana_inicio) = 1)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planejamento_semanal TO authenticated;
GRANT ALL ON public.planejamento_semanal TO service_role;

ALTER TABLE public.planejamento_semanal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own planejamento select" ON public.planejamento_semanal;
DROP POLICY IF EXISTS "own planejamento insert" ON public.planejamento_semanal;
DROP POLICY IF EXISTS "own planejamento update" ON public.planejamento_semanal;
DROP POLICY IF EXISTS "own planejamento delete" ON public.planejamento_semanal;
CREATE POLICY "own planejamento select" ON public.planejamento_semanal FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own planejamento insert" ON public.planejamento_semanal FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own planejamento update" ON public.planejamento_semanal FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own planejamento delete" ON public.planejamento_semanal FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS set_updated_at_planejamento_semanal ON public.planejamento_semanal;
CREATE TRIGGER set_updated_at_planejamento_semanal BEFORE UPDATE ON public.planejamento_semanal
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();