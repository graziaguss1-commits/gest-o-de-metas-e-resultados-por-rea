-- Cronômetro persistente por ocorrência agendada.
-- O acumulado permite pausar/continuar; o instante de início mantém a contagem
-- mesmo se a página for atualizada ou o navegador for fechado.
ALTER TABLE public.tarefa_agendamentos
  ADD COLUMN IF NOT EXISTS cronometro_iniciado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cronometro_segundos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cronometro_usuario_id uuid REFERENCES auth.users(id);

ALTER TABLE public.tarefa_agendamentos
  DROP CONSTRAINT IF EXISTS tarefa_agendamentos_cronometro_segundos_check;
ALTER TABLE public.tarefa_agendamentos
  ADD CONSTRAINT tarefa_agendamentos_cronometro_segundos_check
  CHECK (cronometro_segundos >= 0);

-- Impede dois cronômetros simultâneos para a mesma pessoa, inclusive em abas diferentes.
CREATE UNIQUE INDEX IF NOT EXISTS tarefa_agendamentos_um_timer_ativo_usuario_idx
  ON public.tarefa_agendamentos(cronometro_usuario_id)
  WHERE cronometro_iniciado_em IS NOT NULL
    AND cronometro_usuario_id IS NOT NULL;
