CREATE TABLE public.app_user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connector_id text NOT NULL,
  connection_key_ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.google_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  google_email text,
  calendar_id text NOT NULL DEFAULT 'primary',
  sync_token text,
  webhook_channel_id text,
  webhook_resource_id text,
  webhook_expiration timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.google_calendar_connections TO authenticated;
GRANT ALL ON public.google_calendar_connections TO service_role;
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuario ve a propria conexao google" ON public.google_calendar_connections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Usuario atualiza a propria conexao google" ON public.google_calendar_connections
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.google_calendar_event_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agendamento_id uuid NOT NULL REFERENCES public.tarefa_agendamentos(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  etag text,
  google_updated timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, agendamento_id),
  UNIQUE (user_id, google_event_id)
);
GRANT SELECT ON public.google_calendar_event_links TO authenticated;
GRANT ALL ON public.google_calendar_event_links TO service_role;
ALTER TABLE public.google_calendar_event_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuario ve os proprios vinculos google" ON public.google_calendar_event_links
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.google_busy_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  google_event_id text NOT NULL,
  data date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, google_event_id)
);
GRANT SELECT ON public.google_busy_blocks TO authenticated;
GRANT ALL ON public.google_busy_blocks TO service_role;
ALTER TABLE public.google_busy_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuario ve os proprios blocos ocupados" ON public.google_busy_blocks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_app_user_connections_updated_at BEFORE UPDATE ON public.app_user_connections
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER update_google_calendar_connections_updated_at BEFORE UPDATE ON public.google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER update_google_calendar_event_links_updated_at BEFORE UPDATE ON public.google_calendar_event_links
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER update_google_busy_blocks_updated_at BEFORE UPDATE ON public.google_busy_blocks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();