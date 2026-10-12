-- Sexto motivo de bloco nao cumprido: "outro", com descricao livre.
--
-- Os cinco motivos fixos nao cobrem tudo que acontece numa clinica. "Outro"
-- so e aceito junto com a observacao escrita: um motivo livre sem texto nao
-- explica nada e sujaria o relatorio de padroes.

ALTER TABLE public.bloco_motivos
  DROP CONSTRAINT IF EXISTS bloco_motivos_motivo;

ALTER TABLE public.bloco_motivos
  ADD CONSTRAINT bloco_motivos_motivo
  CHECK (motivo IN ('demanda_equipe','paciente','sem_clareza','cansaco','adiei','outro'));

ALTER TABLE public.bloco_motivos
  DROP CONSTRAINT IF EXISTS bloco_motivos_outro_com_texto;

ALTER TABLE public.bloco_motivos
  ADD CONSTRAINT bloco_motivos_outro_com_texto
  CHECK (motivo <> 'outro' OR (observacao IS NOT NULL AND length(btrim(observacao)) > 0));
