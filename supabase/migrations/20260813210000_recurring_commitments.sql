ALTER TABLE public.compromissos
  ADD COLUMN IF NOT EXISTS recorrencia text NOT NULL DEFAULT 'nenhuma',
  ADD COLUMN IF NOT EXISTS recorrencia_fim date;

ALTER TABLE public.compromissos
  DROP CONSTRAINT IF EXISTS compromissos_recorrencia_check;
ALTER TABLE public.compromissos
  ADD CONSTRAINT compromissos_recorrencia_check
  CHECK (recorrencia IN ('nenhuma','semanal','quinzenal','mensal'));

ALTER TABLE public.compromissos
  DROP CONSTRAINT IF EXISTS compromissos_recorrencia_fim_check;
ALTER TABLE public.compromissos
  ADD CONSTRAINT compromissos_recorrencia_fim_check
  CHECK (recorrencia = 'nenhuma' OR recorrencia_fim IS NULL OR recorrencia_fim >= data);

COMMENT ON COLUMN public.compromissos.recorrencia IS
  'Periodicidade da série. As ocorrências são calculadas apenas para a janela visível.';
