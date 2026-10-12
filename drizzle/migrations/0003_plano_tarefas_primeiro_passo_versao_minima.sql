ALTER TABLE public.plano_tarefas
  ADD COLUMN primeiro_passo text,
  ADD COLUMN versao_minima text;

COMMENT ON COLUMN public.plano_tarefas.primeiro_passo IS 'Menor ação concreta que destrava a tarefa (exibida ao iniciar o bloco na tela Hoje).';
COMMENT ON COLUMN public.plano_tarefas.versao_minima IS 'Critério mínimo de entrega para evitar perfeccionismo (exibido ao iniciar o bloco na tela Hoje).';

ALTER TABLE public.plano_tarefas
  ADD CONSTRAINT plano_tarefas_primeiro_passo_len CHECK (primeiro_passo IS NULL OR char_length(primeiro_passo) <= 140),
  ADD CONSTRAINT plano_tarefas_versao_minima_len CHECK (versao_minima IS NULL OR char_length(versao_minima) <= 140);