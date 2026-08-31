-- Suporte a múltiplas origens de espelhamento no Google
ALTER TABLE public.google_calendar_event_links
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'agendamento',
  ADD COLUMN IF NOT EXISTS origem_id uuid;

UPDATE public.google_calendar_event_links
  SET origem_id = agendamento_id
  WHERE origem_id IS NULL AND agendamento_id IS NOT NULL;

DELETE FROM public.google_calendar_event_links WHERE origem_id IS NULL;

ALTER TABLE public.google_calendar_event_links
  ALTER COLUMN origem_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'google_calendar_event_links_origem_check'
  ) THEN
    ALTER TABLE public.google_calendar_event_links
      ADD CONSTRAINT google_calendar_event_links_origem_check
      CHECK (origem IN ('agendamento', 'compromisso', 'acao_avulsa'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS google_calendar_event_links_origem_uniq
  ON public.google_calendar_event_links (user_id, origem, origem_id);

-- Fuso horário do calendário escolhido no Google
ALTER TABLE public.google_calendar_connections
  ADD COLUMN IF NOT EXISTS calendar_timezone text;