-- Permite transformar uma ação avulsa priorizada em um bloco único da agenda.
ALTER TABLE public.acoes_avulsas
  ADD COLUMN IF NOT EXISTS data_agendada date,
  ADD COLUMN IF NOT EXISTS hora_inicio time without time zone,
  ADD COLUMN IF NOT EXISTS duracao_minutos integer
    CHECK (duracao_minutos IS NULL OR duracao_minutos > 0);

CREATE INDEX IF NOT EXISTS acoes_avulsas_agenda_idx
  ON public.acoes_avulsas (data_agendada, hora_inicio)
  WHERE data_agendada IS NOT NULL;

COMMENT ON COLUMN public.acoes_avulsas.data_agendada
  IS 'Dia escolhido no planejamento semanal para executar a ação.';
COMMENT ON COLUMN public.acoes_avulsas.hora_inicio
  IS 'Horário inicial do bloco reservado no calendário.';
COMMENT ON COLUMN public.acoes_avulsas.duracao_minutos
  IS 'Duração estimada do bloco reservado para a ação avulsa.';
