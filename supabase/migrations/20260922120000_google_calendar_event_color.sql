-- Cor preferida para os eventos criados pelo Metasia no Google Agenda.
ALTER TABLE public.google_calendar_connections
  ADD COLUMN IF NOT EXISTS event_color_id text;

ALTER TABLE public.google_calendar_connections
  DROP CONSTRAINT IF EXISTS google_calendar_connections_event_color_id_check;

ALTER TABLE public.google_calendar_connections
  ADD CONSTRAINT google_calendar_connections_event_color_id_check
  CHECK (event_color_id IS NULL OR event_color_id ~ '^[0-9]{1,3}$');
