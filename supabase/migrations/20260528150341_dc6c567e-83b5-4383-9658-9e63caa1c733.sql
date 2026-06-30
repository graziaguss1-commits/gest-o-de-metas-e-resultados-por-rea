
-- 1) Novos campos em app_settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS gsheets_url text,
  ADD COLUMN IF NOT EXISTS evolution_configured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS evolution_base_url text,
  ADD COLUMN IF NOT EXISTS evolution_instance text;

-- 2) Tabela de modelos de notificações
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  canal text NOT NULL DEFAULT 'slack',         -- slack | whatsapp | email | in_app
  evento text NOT NULL,                         -- meta_risco | meta_criada | plano_criado | resumo_semanal | custom
  mensagem_template text NOT NULL,
  ativo boolean NOT NULL DEFAULT false,
  is_custom boolean NOT NULL DEFAULT false,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read templates"
  ON public.notification_templates FOR SELECT
  TO authenticated
  USING (public.is_active_member());

CREATE POLICY "members insert templates"
  ON public.notification_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_member() AND (criado_por = auth.uid() OR criado_por IS NULL));

CREATE POLICY "owners or admins update templates"
  ON public.notification_templates FOR UPDATE
  TO authenticated
  USING (public.is_active_member() AND (criado_por = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)))
  WITH CHECK (public.is_active_member());

CREATE POLICY "owners or admins delete templates"
  ON public.notification_templates FOR DELETE
  TO authenticated
  USING (public.is_active_member() AND (criado_por = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)));

CREATE TRIGGER trg_notification_templates_updated
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3) Seeds (modelos padrão)
INSERT INTO public.notification_templates (nome, descricao, canal, evento, mensagem_template, ativo, is_custom)
VALUES
  ('Meta em risco', 'Dispara quando uma meta entra em status vermelho.', 'slack', 'meta_risco',
   ':rotating_light: A meta *{meta_nome}* está em risco. Desvio atual: {desvio}%. Responsável: {responsavel}.', false, false),
  ('Nova meta criada', 'Notifica o time quando uma nova meta é cadastrada.', 'slack', 'meta_criada',
   ':dart: Nova meta criada: *{meta_nome}* — alvo {valor_alvo} {unidade} até {data_fim}.', false, false),
  ('Plano de ação adicionado', 'Notifica quando um novo plano de ação é vinculado a uma meta.', 'slack', 'plano_criado',
   ':clipboard: Novo plano de ação *{plano_titulo}* adicionado à meta *{meta_nome}*.', false, false),
  ('Resumo semanal', 'Resumo das metas e desempenho da semana enviado às segundas.', 'slack', 'resumo_semanal',
   ':bar_chart: Resumo semanal: {qtd_verde} no verde, {qtd_amarelo} em atenção, {qtd_vermelho} em risco.', false, false)
ON CONFLICT DO NOTHING;
