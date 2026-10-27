-- Historico das frases do coach, para nao repetir a mesma em 7 dias.
--
-- Cada chamada ao modelo e independente e nao lembra da anterior, entao
-- "nao repita" so vira regra de verdade se o historico voltar para o pedido.
-- Aqui ficam as frases ENVIADAS; a funcao le as dos ultimos 7 dias dos tipos
-- de bloco da mensagem e manda junto como lista do que nao repetir.
--
-- `tipo` e o titulo normalizado, nao o id do bloco: "Postar reels" de hoje e
-- de amanha sao agendamentos diferentes e o mesmo tipo de tarefa. Comparar
-- por id deixaria a frase se repetir todo dia numa rotina, que e exatamente
-- onde repetir incomoda mais.
--
-- Escrita so pelo service_role: quem grava e a edge function. A usuaria le o
-- proprio historico, nada mais.

CREATE TABLE IF NOT EXISTS public.coach_frases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  data date NOT NULL,
  referencia text NOT NULL,
  tipo text NOT NULL,
  frase text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.coach_frases TO authenticated;
GRANT ALL ON public.coach_frases TO service_role;

ALTER TABLE public.coach_frases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own frases select" ON public.coach_frases;
CREATE POLICY "own frases select" ON public.coach_frases
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS coach_frases_user_data_idx ON public.coach_frases (user_id, data DESC);

-- O plano de evolucao de 4 semanas saiu da tela de configuracoes a pedido
-- dela, e o prompt do coach parou de usar os dois campos. As colunas ficam:
-- nao apago coluna com texto dela dentro so para limpar.
