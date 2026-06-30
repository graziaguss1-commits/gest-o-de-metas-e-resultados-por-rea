ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS whatsapp_alerts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_resumo_semanal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_desvio_threshold integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS whatsapp_destino text;