ALTER TABLE public.plano_tarefas
  ADD COLUMN IF NOT EXISTS duracao_minutos integer,
  ADD COLUMN IF NOT EXISTS horario_preferencial time,
  ADD COLUMN IF NOT EXISTS dias_semana smallint[];

ALTER TABLE public.tarefa_execucoes
  ADD COLUMN IF NOT EXISTS tempo_real_minutos integer;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS capacidade_diaria_minutos integer NOT NULL DEFAULT 480;

CREATE TABLE IF NOT EXISTS public.tarefa_agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.plano_tarefas(id) ON DELETE CASCADE,
  data date NOT NULL,
  hora_inicio time NOT NULL,
  duracao_minutos integer NOT NULL DEFAULT 30,
  observacao text,
  criado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefa_agendamentos TO authenticated;
GRANT ALL ON public.tarefa_agendamentos TO service_role;

ALTER TABLE public.tarefa_agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read agendamentos" ON public.tarefa_agendamentos
  FOR SELECT TO authenticated USING (public.is_active_member());
CREATE POLICY "members insert agendamentos" ON public.tarefa_agendamentos
  FOR INSERT TO authenticated WITH CHECK (public.is_active_member() AND (criado_por = auth.uid() OR criado_por IS NULL));
CREATE POLICY "members update agendamentos" ON public.tarefa_agendamentos
  FOR UPDATE TO authenticated USING (public.is_active_member()) WITH CHECK (public.is_active_member());
CREATE POLICY "owners delete agendamentos" ON public.tarefa_agendamentos
  FOR DELETE TO authenticated USING (public.is_active_member() AND (criado_por = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)));

CREATE INDEX IF NOT EXISTS idx_tarefa_agendamentos_data ON public.tarefa_agendamentos(data);
CREATE INDEX IF NOT EXISTS idx_tarefa_agendamentos_tarefa ON public.tarefa_agendamentos(tarefa_id);

CREATE TRIGGER tarefa_agendamentos_set_updated_at
  BEFORE UPDATE ON public.tarefa_agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();