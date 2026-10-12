CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.whatsapp_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  referencia text NOT NULL,
  data date NOT NULL,
  status text NOT NULL DEFAULT 'enviando',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_envios_unico UNIQUE (user_id, tipo, referencia, data)
);
GRANT SELECT ON public.whatsapp_envios TO authenticated;
GRANT ALL ON public.whatsapp_envios TO service_role;
ALTER TABLE public.whatsapp_envios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own whatsapp envios" ON public.whatsapp_envios;
CREATE POLICY "own whatsapp envios" ON public.whatsapp_envios FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP TRIGGER IF EXISTS set_updated_at_whatsapp_envios ON public.whatsapp_envios;
CREATE TRIGGER set_updated_at_whatsapp_envios BEFORE UPDATE ON public.whatsapp_envios
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.whatsapp_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  tipo text NOT NULL,
  referencia text,
  destino_mascarado text,
  status text NOT NULL,
  erro text
);
CREATE INDEX IF NOT EXISTS whatsapp_log_user_data_idx ON public.whatsapp_log (user_id, criado_em DESC);
GRANT SELECT ON public.whatsapp_log TO authenticated;
GRANT ALL ON public.whatsapp_log TO service_role;
ALTER TABLE public.whatsapp_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own whatsapp log" ON public.whatsapp_log;
CREATE POLICY "own whatsapp log" ON public.whatsapp_log FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- Segredo que o agendador envia à função; legível só pelo backend.
CREATE TABLE IF NOT EXISTS public.cron_segredos (
  nome text PRIMARY KEY,
  valor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.cron_segredos FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.cron_segredos TO service_role;
ALTER TABLE public.cron_segredos ENABLE ROW LEVEL SECURITY;
INSERT INTO public.cron_segredos (nome, valor)
VALUES ('whatsapp_agenda', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (nome) DO NOTHING;