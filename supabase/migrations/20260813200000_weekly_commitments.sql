CREATE TABLE public.compromissos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  data date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  area text NOT NULL DEFAULT 'Pessoal',
  observacao text,
  concluido boolean NOT NULL DEFAULT false,
  criado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT compromissos_horario_check CHECK (hora_fim > hora_inicio)
);

CREATE INDEX compromissos_data_hora_idx ON public.compromissos(data, hora_inicio);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compromissos TO authenticated;
GRANT ALL ON public.compromissos TO service_role;
ALTER TABLE public.compromissos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read commitments" ON public.compromissos
  FOR SELECT TO authenticated USING (public.is_active_member());
CREATE POLICY "members create commitments" ON public.compromissos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member() AND criado_por = auth.uid());
CREATE POLICY "members update commitments" ON public.compromissos
  FOR UPDATE TO authenticated USING (public.is_active_member())
  WITH CHECK (public.is_active_member());
CREATE POLICY "members delete commitments" ON public.compromissos
  FOR DELETE TO authenticated USING (public.is_active_member());

CREATE TRIGGER compromissos_set_updated_at
  BEFORE UPDATE ON public.compromissos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
