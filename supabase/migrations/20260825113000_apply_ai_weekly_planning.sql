-- Aplica a proposta semanal aprovada pela usuária em uma única transação.
-- O Claude apenas sugere; esta função revalida período, formato e propriedade
-- de cada ação antes de escrever qualquer bloco no calendário.

create or replace function public.aplicar_planejamento_semanal(
  p_inicio date,
  p_fim date,
  p_agenda jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_task_id uuid;
  v_origem text;
  v_data date;
  v_hora time without time zone;
  v_duracao integer;
  v_chave text;
  v_chaves text[] := array[]::text[];
  v_criados integer := 0;
  v_atualizados integer := 0;
  v_ignorados integer := 0;
begin
  if auth.uid() is null or not public.is_active_member() then
    raise exception 'Sua sessão não está ativa.';
  end if;

  if p_inicio is null or p_fim is null or p_fim <> p_inicio + 6 then
    raise exception 'A janela do planejamento deve conter exatamente sete dias.';
  end if;

  if jsonb_typeof(coalesce(p_agenda, '[]'::jsonb)) <> 'array' then
    raise exception 'A agenda enviada é inválida.';
  end if;

  if jsonb_array_length(coalesce(p_agenda, '[]'::jsonb)) > 100 then
    raise exception 'Há blocos demais para aplicar de uma só vez.';
  end if;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_agenda, '[]'::jsonb))
  loop
    begin
      v_task_id := nullif(btrim(v_item->>'task_id'), '')::uuid;
      v_origem := lower(btrim(v_item->>'origem'));
      v_data := nullif(v_item->>'data', '')::date;
      v_hora := nullif(v_item->>'hora_inicio', '')::time;
      v_duracao := nullif(v_item->>'duracao_minutos', '')::integer;
    exception
      when invalid_text_representation or datetime_field_overflow then
        raise exception 'Um dos blocos possui data, horário ou identificação inválida.';
    end;

    if v_task_id is null
      or v_origem not in ('plano', 'avulsa')
      or v_data not between p_inicio and p_fim
      or v_hora is null
      or v_duracao is null
      or v_duracao < 5
      or v_duracao > 720
    then
      raise exception 'Um dos blocos está fora da semana ou possui duração inválida.';
    end if;

    v_chave := v_origem || '|' || v_task_id::text || '|' || v_data::text || '|' || v_hora::text;
    if v_chave = any(v_chaves) then
      raise exception 'A proposta contém um bloco duplicado.';
    end if;
    v_chaves := array_append(v_chaves, v_chave);

    if v_origem = 'plano' then
      perform 1
      from public.plano_tarefas tarefa
      where tarefa.id = v_task_id
        and tarefa.responsavel_id = auth.uid()
        and tarefa.concluida = false;

      if not found or not public.is_task_responsavel(v_task_id) then
        raise exception 'Você não pode agendar uma das ações desta proposta.';
      end if;

      if exists (
        select 1
        from public.tarefa_agendamentos agendamento
        where agendamento.tarefa_id = v_task_id
          and agendamento.data = v_data
          and agendamento.hora_inicio = v_hora
          and agendamento.observacao is distinct from 'Ocorrência cancelada'
      ) then
        v_ignorados := v_ignorados + 1;
      else
        insert into public.tarefa_agendamentos (
          tarefa_id,
          data,
          hora_inicio,
          duracao_minutos,
          observacao,
          criado_por
        ) values (
          v_task_id,
          v_data,
          v_hora,
          v_duracao,
          'Planejado com Claude',
          auth.uid()
        );
        v_criados := v_criados + 1;
      end if;
    else
      update public.acoes_avulsas
      set
        data_agendada = v_data,
        hora_inicio = v_hora,
        duracao_minutos = v_duracao
      where id = v_task_id
        and criado_por = auth.uid()
        and concluida = false;

      if not found then
        raise exception 'Você não pode agendar uma das ações avulsas desta proposta.';
      end if;
      v_atualizados := v_atualizados + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'agendamentos_criados', v_criados,
    'acoes_avulsas_atualizadas', v_atualizados,
    'duplicados_ignorados', v_ignorados
  );
end;
$$;

revoke execute on function public.aplicar_planejamento_semanal(date, date, jsonb)
  from public, anon;
grant execute on function public.aplicar_planejamento_semanal(date, date, jsonb)
  to authenticated;

comment on function public.aplicar_planejamento_semanal(date, date, jsonb) is
  'Aplica de forma atômica somente os blocos do planejamento semanal aprovados pela usuária.';
