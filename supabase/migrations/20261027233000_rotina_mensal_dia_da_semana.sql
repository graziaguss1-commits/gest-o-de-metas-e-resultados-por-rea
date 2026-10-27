-- Rotina mensal tambem por posicao no mes: "toda primeira sexta".
--
-- Ate aqui a mensal so sabia dia do mes, guardado em dias_semana[0] para
-- evitar migration na epoca. Serve para "avaliar DRE todo dia 10" e nao serve
-- para nada que acontece por agenda de gente — aula, reuniao, fechamento —
-- porque o dia 10 cai num dia da semana diferente a cada mes.
--
-- Colunas separadas em vez de mais convencao dentro de dias_semana: ja havia
-- um significado escondido ali, e empilhar um segundo transformaria o array
-- em charada. Aqui cada coisa tem nome.
--
-- semana_do_mes = -1 e "ultima", nao 5. Outubro de 2026 tem 5 sextas e
-- novembro tem 4: guardar o numero faria a rotina pular novembro inteiro.
--
-- Default 'dia_do_mes' mantem as 72 acoes existentes exatamente como estao.

ALTER TABLE public.plano_tarefas
  ADD COLUMN IF NOT EXISTS recorrencia_mensal text NOT NULL DEFAULT 'dia_do_mes',
  ADD COLUMN IF NOT EXISTS semana_do_mes smallint,
  ADD COLUMN IF NOT EXISTS dia_semana_mensal smallint;

ALTER TABLE public.plano_tarefas DROP CONSTRAINT IF EXISTS plano_tarefas_recorrencia_mensal_check;
ALTER TABLE public.plano_tarefas ADD CONSTRAINT plano_tarefas_recorrencia_mensal_check
  CHECK (recorrencia_mensal IN ('dia_do_mes','dia_da_semana'));

ALTER TABLE public.plano_tarefas DROP CONSTRAINT IF EXISTS plano_tarefas_semana_do_mes_check;
ALTER TABLE public.plano_tarefas ADD CONSTRAINT plano_tarefas_semana_do_mes_check
  CHECK (semana_do_mes IS NULL OR semana_do_mes = -1 OR semana_do_mes BETWEEN 1 AND 5);

-- 1 = segunda ... 7 = domingo, a mesma convencao de diaISO no app.
ALTER TABLE public.plano_tarefas DROP CONSTRAINT IF EXISTS plano_tarefas_dia_semana_mensal_check;
ALTER TABLE public.plano_tarefas ADD CONSTRAINT plano_tarefas_dia_semana_mensal_check
  CHECK (dia_semana_mensal IS NULL OR dia_semana_mensal BETWEEN 1 AND 7);
