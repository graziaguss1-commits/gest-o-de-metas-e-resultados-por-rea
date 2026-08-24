ALTER TABLE public.plano_tarefas
  ADD COLUMN IF NOT EXISTS execucoes_planejadas integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'plano_tarefas_execucoes_planejadas_check'
      AND conrelid = 'public.plano_tarefas'::regclass
  ) THEN
    ALTER TABLE public.plano_tarefas
      ADD CONSTRAINT plano_tarefas_execucoes_planejadas_check
      CHECK (execucoes_planejadas BETWEEN 1 AND 100);
  END IF;
END
$$;

COMMENT ON COLUMN public.plano_tarefas.execucoes_planejadas IS
  'Quantidade de blocos de calendário necessários em cada período da ação. Não se confunde com a quantidade de resultado.';
