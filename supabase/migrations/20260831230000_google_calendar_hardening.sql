-- Endurecimento da sincronização individual Google Agenda <-> Metasia.

ALTER TABLE public.google_calendar_event_links
  ADD COLUMN IF NOT EXISTS origem_chave text,
  ADD COLUMN IF NOT EXISTS source_date date,
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz;

UPDATE public.google_calendar_event_links
SET origem_chave = origem || ':' || origem_id::text
WHERE origem_chave IS NULL;

UPDATE public.google_calendar_event_links
SET source_updated_at = updated_at
WHERE source_updated_at IS NULL;

ALTER TABLE public.google_calendar_event_links
  ALTER COLUMN origem_chave SET NOT NULL;

DROP INDEX IF EXISTS public.google_calendar_event_links_origem_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS google_calendar_event_links_origem_chave_uniq
  ON public.google_calendar_event_links (user_id, origem_chave);

ALTER TABLE public.google_calendar_connections
  ADD COLUMN IF NOT EXISTS webhook_token text,
  ADD COLUMN IF NOT EXISTS sync_lock_until timestamptz,
  ADD COLUMN IF NOT EXISTS needs_reconnect boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_error_code text;

CREATE TABLE IF NOT EXISTS public.compromisso_ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  compromisso_id uuid NOT NULL REFERENCES public.compromissos(id) ON DELETE CASCADE,
  data_original date NOT NULL,
  data date,
  hora_inicio time,
  hora_fim time,
  cancelado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, compromisso_id, data_original),
  CONSTRAINT compromisso_ocorrencias_horario_check CHECK (
    cancelado OR (data IS NOT NULL AND hora_inicio IS NOT NULL AND hora_fim IS NOT NULL)
  )
);

ALTER TABLE public.compromisso_ocorrencias ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.compromisso_ocorrencias TO authenticated;
GRANT ALL ON public.compromisso_ocorrencias TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'compromisso_ocorrencias'
      AND policyname = 'Usuario ve as proprias alteracoes de compromisso'
  ) THEN
    CREATE POLICY "Usuario ve as proprias alteracoes de compromisso"
      ON public.compromisso_ocorrencias
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_compromisso_ocorrencias_updated_at'
  ) THEN
    CREATE TRIGGER update_compromisso_ocorrencias_updated_at
      BEFORE UPDATE ON public.compromisso_ocorrencias
      FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.google_calendar_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, state_hash)
);

ALTER TABLE public.google_calendar_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_calendar_oauth_states FROM anon, authenticated;
GRANT ALL ON public.google_calendar_oauth_states TO service_role;

-- A chave de conexão criptografada nunca pode ser acessada pelo navegador.
REVOKE ALL ON public.app_user_connections FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_connections TO service_role;

CREATE OR REPLACE FUNCTION public.acquire_google_calendar_sync_lock(
  _user_id uuid,
  _seconds integer DEFAULT 120
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.google_calendar_connections
  SET sync_lock_until = now() + make_interval(secs => GREATEST(30, LEAST(_seconds, 300)))
  WHERE user_id = _user_id
    AND (sync_lock_until IS NULL OR sync_lock_until < now());
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_google_calendar_sync_lock(_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.google_calendar_connections
  SET sync_lock_until = NULL
  WHERE user_id = _user_id;
$$;

REVOKE ALL ON FUNCTION public.acquire_google_calendar_sync_lock(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_google_calendar_sync_lock(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_google_calendar_sync_lock(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_google_calendar_sync_lock(uuid) TO service_role;
