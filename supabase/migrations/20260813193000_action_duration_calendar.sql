-- Planejamento de capacidade por ação
ALTER TABLE public.plano_tarefas
  ADD COLUMN IF NOT EXISTS duracao_estimada_minutos integer,
  ADD COLUMN IF NOT EXISTS horario_preferencial time,
  ADD COLUMN IF NOT EXISTS dias_semana integer[];

ALTER TABLE public.plano_tarefas
  DROP CONSTRAINT IF EXISTS plano_tarefas_duracao_estimada_check;
ALTER TABLE public.plano_tarefas
  ADD CONSTRAINT plano_tarefas_duracao_estimada_check
  CHECK (duracao_estimada_minutos IS NULL OR duracao_estimada_minutos > 0);

ALTER TABLE public.plano_tarefas
  DROP CONSTRAINT IF EXISTS plano_tarefas_dias_semana_check;
ALTER TABLE public.plano_tarefas
  ADD CONSTRAINT plano_tarefas_dias_semana_check
  CHECK (
    dias_semana IS NULL OR
    dias_semana <@ ARRAY[0,1,2,3,4,5,6]::integer[]
  );

ALTER TABLE public.tarefa_execucoes
  ADD COLUMN IF NOT EXISTS tempo_real_minutos integer;

ALTER TABLE public.tarefa_execucoes
  DROP CONSTRAINT IF EXISTS tarefa_execucoes_tempo_real_check;
ALTER TABLE public.tarefa_execucoes
  ADD CONSTRAINT tarefa_execucoes_tempo_real_check
  CHECK (tempo_real_minutos IS NULL OR tempo_real_minutos > 0);

CREATE TABLE IF NOT EXISTS public.agenda_ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.plano_tarefas(id) ON DELETE CASCADE,
  data date NOT NULL,
  hora_inicio time NOT NULL,
  duracao_minutos integer NOT NULL CHECK (duracao_minutos > 0),
  status text NOT NULL DEFAULT 'planejada' CHECK (status IN ('planejada','concluida','cancelada')),
  criado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tarefa_id, data, hora_inicio)
);

CREATE INDEX IF NOT EXISTS agenda_ocorrencias_data_idx
  ON public.agenda_ocorrencias(data, hora_inicio);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_ocorrencias TO authenticated;
GRANT ALL ON public.agenda_ocorrencias TO service_role;
ALTER TABLE public.agenda_ocorrencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read agenda" ON public.agenda_ocorrencias
  FOR SELECT TO authenticated USING (public.is_active_member());
CREATE POLICY "members create agenda" ON public.agenda_ocorrencias
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member() AND criado_por = auth.uid());
CREATE POLICY "members update agenda" ON public.agenda_ocorrencias
  FOR UPDATE TO authenticated
  USING (public.is_active_member())
  WITH CHECK (public.is_active_member());
CREATE POLICY "members delete agenda" ON public.agenda_ocorrencias
  FOR DELETE TO authenticated
  USING (public.is_active_member());

CREATE TRIGGER agenda_ocorrencias_set_updated_at
  BEFORE UPDATE ON public.agenda_ocorrencias
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
