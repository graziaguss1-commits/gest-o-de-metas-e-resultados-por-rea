-- Cada conclusão feita no calendário pertence a um único bloco agendado.
-- O histórico é preservado mesmo que o bloco seja removido depois.
ALTER TABLE public.tarefa_execucoes
  ADD COLUMN IF NOT EXISTS agendamento_id uuid
  REFERENCES public.tarefa_agendamentos(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tarefa_execucoes_agendamento_unique_idx
  ON public.tarefa_execucoes(agendamento_id)
  WHERE agendamento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tarefa_execucoes_agendamento_idx
  ON public.tarefa_execucoes(agendamento_id);
