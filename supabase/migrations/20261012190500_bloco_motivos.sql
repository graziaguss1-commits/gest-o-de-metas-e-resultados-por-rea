CREATE TABLE IF NOT EXISTS public.bloco_motivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  referencia text NOT NULL,
  data date NOT NULL,
  motivo text NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bloco_motivos_unico UNIQUE (user_id, referencia, data),
  CONSTRAINT bloco_motivos_motivo CHECK (motivo IN ('demanda_equipe','paciente','sem_clareza','cansaco','adiei')),
  CONSTRAINT bloco_motivos_referencia CHECK (referencia ~ '^(ag|av|cp):'),
  CONSTRAINT bloco_motivos_obs CHECK (observacao IS NULL OR length(observacao) <= 500)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bloco_motivos TO authenticated;
GRANT ALL ON public.bloco_motivos TO service_role;
ALTER TABLE public.bloco_motivos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own motivos select" ON public.bloco_motivos;
DROP POLICY IF EXISTS "own motivos insert" ON public.bloco_motivos;
DROP POLICY IF EXISTS "own motivos update" ON public.bloco_motivos;
DROP POLICY IF EXISTS "own motivos delete" ON public.bloco_motivos;
CREATE POLICY "own motivos select" ON public.bloco_motivos FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own motivos insert" ON public.bloco_motivos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own motivos update" ON public.bloco_motivos FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own motivos delete" ON public.bloco_motivos FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS bloco_motivos_user_data_idx ON public.bloco_motivos (user_id, data);
DROP TRIGGER IF EXISTS set_updated_at_bloco_motivos ON public.bloco_motivos;
CREATE TRIGGER set_updated_at_bloco_motivos BEFORE UPDATE ON public.bloco_motivos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();