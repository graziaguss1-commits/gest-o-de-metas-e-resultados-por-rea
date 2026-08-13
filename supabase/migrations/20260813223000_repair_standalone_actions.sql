-- Repair/ensure standalone actions persistence in environments where the
-- application deployment reached production before the original migration.
CREATE TABLE IF NOT EXISTS public.acoes_avulsas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  area text NOT NULL CHECK (area IN ('Clínica', 'Mentoria', 'Pessoal')),
  impacto integer NOT NULL CHECK (impacto BETWEEN 0 AND 10),
  esforco integer NOT NULL CHECK (esforco BETWEEN 0 AND 10),
  prazo date,
  concluida boolean NOT NULL DEFAULT false,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS acoes_avulsas_priority_idx
  ON public.acoes_avulsas (concluida, impacto DESC, esforco ASC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.acoes_avulsas TO authenticated;
GRANT ALL ON public.acoes_avulsas TO service_role;

ALTER TABLE public.acoes_avulsas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members manage standalone actions" ON public.acoes_avulsas;
CREATE POLICY "members manage standalone actions"
  ON public.acoes_avulsas
  FOR ALL TO authenticated
  USING (public.is_active_member())
  WITH CHECK (public.is_active_member());

DROP TRIGGER IF EXISTS acoes_avulsas_set_updated_at ON public.acoes_avulsas;
CREATE TRIGGER acoes_avulsas_set_updated_at
  BEFORE UPDATE ON public.acoes_avulsas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
