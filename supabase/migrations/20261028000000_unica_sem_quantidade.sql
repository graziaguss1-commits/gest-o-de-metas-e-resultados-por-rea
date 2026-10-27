-- Acao unica nao tem quantidade nem unidade: ou foi feita, ou nao foi.
--
-- Os dois campos apareciam na tela mesmo em acao unica, e serviam so para
-- abrir espaco de erro. Foi o que aconteceu: sete acoes ficaram com a unidade
-- gravada como "1", e a tela montava "0 de " + 1 + " " + "1", que se le como
-- "0 de 11". Numero plausivel e errado, que e o pior tipo.
--
-- As 39 acoes unicas do sistema tinham todas quantidade 1. Nenhuma usava o
-- campo para outra coisa, entao esconde-lo nao tira nada de ninguem.
--
-- Esta migracao limpa o que ja estava gravado. A tela, a partir de agora, nao
-- deixa mais preencher.

UPDATE public.plano_tarefas
SET unidade = '', quantidade_planejada = 1
WHERE frequencia = 'unica' AND (trim(coalesce(unidade, '')) <> '' OR quantidade_planejada <> 1);
