-- Perfil do coach: como ele deve falar com a usuária.
--
-- O texto das instrucoes mora AQUI, no banco, e nao dentro do codigo da edge
-- function. Coach e coisa que se ajusta: trocar o tom, incluir uma regra nova,
-- tirar uma que nao funcionou. No codigo, cada ajuste exigiria publicar a
-- funcao de novo. No banco, e um UPDATE.
--
-- Linha unica (id = 1), como app_settings.

CREATE TABLE IF NOT EXISTS public.coach_perfil (
  id integer PRIMARY KEY CHECK (id = 1),
  ativo boolean NOT NULL DEFAULT false,
  -- Quem e a pessoa, na voz dela.
  contexto text NOT NULL DEFAULT '',
  -- Como falar: tom, o que evitar.
  tom text NOT NULL DEFAULT '',
  -- O que fazer quando certos padroes aparecerem.
  regras text NOT NULL DEFAULT '',
  -- Teto de caracteres da mensagem, para nao virar textao no WhatsApp.
  limite_caracteres integer NOT NULL DEFAULT 700
    CHECK (limite_caracteres BETWEEN 200 AND 1500),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.coach_perfil (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON public.coach_perfil TO authenticated;
GRANT ALL ON public.coach_perfil TO service_role;

ALTER TABLE public.coach_perfil ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read coach" ON public.coach_perfil;
DROP POLICY IF EXISTS "admins write coach" ON public.coach_perfil;
CREATE POLICY "admins read coach" ON public.coach_perfil
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admins write coach" ON public.coach_perfil
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS set_updated_at_coach_perfil ON public.coach_perfil;
CREATE TRIGGER set_updated_at_coach_perfil BEFORE UPDATE ON public.coach_perfil
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Perfil de vendas e plano de evolucao de 4 semanas.
--
-- O conteudo destes campos e pessoal e fica SO no banco: este repositorio e
-- publico. A migracao cria as colunas vazias.
--
-- plano_inicio guarda a data em que o plano comecou; a semana ativa (1 a 4) e
-- calculada a partir dela, em vez de um contador guardado, para a semana
-- avancar sozinha e nao existir estado para dessincronizar.

ALTER TABLE public.coach_perfil
  ADD COLUMN IF NOT EXISTS perfil_vendas text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS plano_evolucao text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS plano_inicio date;
