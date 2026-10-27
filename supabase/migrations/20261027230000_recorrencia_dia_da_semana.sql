-- "Todo mes" era ambiguo e o app so sabia uma das respostas.
--
-- A repeticao mensal guardava o DIA DO MES e repetia nele. Para uma aula que
-- acontece na ultima sexta, isso erra todo mes: 30/10/2026 e sexta, mas
-- 30/11/2026 e segunda. O compromisso aparecia no dia errado e a usuaria nao
-- tinha como expressar a regra que ela realmente usa.
--
-- 'mensal_dia_semana' repete pela posicao no mes: terceira terca, ultima
-- sexta. O dia da semana e a posicao saem da PRIMEIRA data da serie, entao
-- nao ha coluna nova para manter em dia.
--
-- "Ultima" e guardada como propriedade, nao como o numero 5: outubro de 2026
-- tem 5 sextas e novembro tem 4, e uma regra presa ao numero pularia novembro.

ALTER TABLE public.compromissos DROP CONSTRAINT IF EXISTS compromissos_recorrencia_check;
ALTER TABLE public.compromissos ADD CONSTRAINT compromissos_recorrencia_check
  CHECK (recorrencia = ANY (ARRAY['nenhuma','semanal','quinzenal','mensal','mensal_dia_semana']));
