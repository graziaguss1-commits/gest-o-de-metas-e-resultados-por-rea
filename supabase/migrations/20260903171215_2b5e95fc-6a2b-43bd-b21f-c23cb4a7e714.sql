
-- 1. search_path on remaining functions
ALTER FUNCTION public.calcular_status_meta(numeric, numeric, date, date, boolean) SET search_path = public;
ALTER FUNCTION public.tg_set_updated_at() SET search_path = public;

-- 2. Revoke EXECUTE from anon/public/authenticated where not needed
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.check_email_domain()',
    'public.handle_new_user()',
    'public.tg_proteger_conclusao_tarefa()',
    'public.tg_validar_responsavel_principal_meta()',
    'public.tg_validar_responsavel_tarefa()',
    'public.tg_set_updated_at()',
    'public.ensure_auth_trigger()',
    'public.get_handle_new_user_def()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.store_vault_secret(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_active_member() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.calcular_status_meta(numeric, numeric, date, date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_member() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calcular_status_meta(numeric, numeric, date, date, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.store_vault_secret(text, text) TO authenticated, service_role;

-- 3. profiles: self-insert cannot be pre-approved
DROP POLICY IF EXISTS "Service inserts profiles" ON public.profiles;
CREATE POLICY "Users insert own unapproved profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id AND is_approved = false);

-- 4. profiles: block self-approval / self-activation via trigger
CREATE OR REPLACE FUNCTION public.tg_proteger_flags_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;
  NEW.is_approved := OLD.is_approved;
  NEW.is_active := OLD.is_active;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_proteger_flags_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS proteger_flags_profile ON public.profiles;
CREATE TRIGGER proteger_flags_profile
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_proteger_flags_profile();
