-- Conclusao por OCORRENCIA, nao pela serie.
--
-- `compromissos.concluido` e uma coluna da serie: marcar a reuniao de
-- segunda como feita riscava todas as reunioes de agosto a novembro, porque
-- cada ocorrencia herdava o campo da serie ao ser expandida. A tabela de
-- excecoes por ocorrencia ja existia (data, horario, cancelado); faltava
-- guardar a conclusao no mesmo lugar.
alter table compromisso_ocorrencias
  add column if not exists concluido boolean not null default false;

comment on column compromisso_ocorrencias.concluido is
  'Conclusao DESTA ocorrencia. compromissos.concluido marcava a serie inteira.';
