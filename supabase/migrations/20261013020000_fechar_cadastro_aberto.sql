-- Fecha o cadastro aberto e o vazamento de app_settings.
--
-- Diagnostico: a tabela project_config estava VAZIA. O gatilho
-- handle_new_user decide a aprovacao com
--   WHEN _is_first_user THEN true / WHEN _require_approval THEN false / ELSE true
-- e _require_approval vinha nulo por falta de linha, caindo no ELSE. Resultado:
-- qualquer pessoa criava conta e entrava aprovada, ativa, com papel de agent.
--
-- A tela de Seguranca nao conseguia corrigir isso porque usa UPDATE ... WHERE
-- key = ... numa tabela sem linhas: um update que nao casa nada nao e erro, entao
-- a tela avisava "Atualizado" sem gravar. E nao havia policy de INSERT, entao nem
-- um upsert funcionaria.

-- 1. As linhas que faltavam, ja com aprovacao exigida.
INSERT INTO public.project_config (key, value) VALUES
  ('require_account_approval', 'true'),
  ('restrict_signup_by_domain', 'false'),
  ('allowed_email_domains', '')
ON CONFLICT (key) DO NOTHING;

-- 2. Admin passa a poder criar linha de configuracao, nao so alterar.
DROP POLICY IF EXISTS "Admins insert config" ON public.project_config;
CREATE POLICY "Admins insert config" ON public.project_config
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. app_settings guarda o endereco do servidor Evolution, o nome da instancia
--    e o numero de destino do WhatsApp. Estava liberada para qualquer membro
--    ativo. Passa a ser leitura de admin, como ja era a escrita.
DROP POLICY IF EXISTS "members read settings" ON public.app_settings;
DROP POLICY IF EXISTS "admins read settings" ON public.app_settings;
CREATE POLICY "admins read settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
