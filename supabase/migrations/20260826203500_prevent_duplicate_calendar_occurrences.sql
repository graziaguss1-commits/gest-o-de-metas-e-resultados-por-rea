-- A materialização da recorrência podia ser disparada duas vezes quase ao
-- mesmo tempo. As duas chamadas liam a agenda vazia e criavam o mesmo bloco,
-- deixando cartões idênticos sobrepostos no calendário.
--
-- Mantemos as cópias antigas recuperáveis: somente uma ocorrência por horário
-- permanece ativa e as demais recebem uma marca de arquivamento. O índice
-- parcial impede novas duplicidades entre ocorrências ativas.

with ocorrencias_ranqueadas as (
  select
    agendamento.id,
    row_number() over (
      partition by
        agendamento.tarefa_id,
        agendamento.data,
        agendamento.hora_inicio
      order by
        (
          coalesce(agendamento.observacao, '') like
            'Ocorrência duplicada arquivada%'
        ) asc,
        exists (
          select 1
          from public.tarefa_execucoes execucao
          where execucao.agendamento_id = agendamento.id
        ) desc,
        (agendamento.cronometro_iniciado_em is not null) desc,
        coalesce(agendamento.cronometro_segundos, 0) desc,
        agendamento.created_at,
        agendamento.id
    ) as posicao
  from public.tarefa_agendamentos agendamento
)
update public.tarefa_agendamentos agendamento
set observacao = concat(
  'Ocorrência duplicada arquivada',
  case
    when nullif(trim(coalesce(agendamento.observacao, '')), '') is null then ''
    else ' — ' || agendamento.observacao
  end
)
from ocorrencias_ranqueadas ocorrencia
where agendamento.id = ocorrencia.id
  and ocorrencia.posicao > 1
  and coalesce(agendamento.observacao, '') not like
    'Ocorrência duplicada arquivada%';

drop index if exists public.tarefa_agendamentos_slot_unico_idx;

create unique index if not exists tarefa_agendamentos_slot_unico_idx
  on public.tarefa_agendamentos (tarefa_id, data, hora_inicio)
  where coalesce(observacao, '') not like
    'Ocorrência duplicada arquivada%';

comment on index public.tarefa_agendamentos_slot_unico_idx is
  'Impede que a mesma ação ativa ocupe duas vezes o mesmo dia e horário; cópias antigas ficam arquivadas e recuperáveis.';
