-- Quatro janelas do coach por dia, em vez de uma mensagem de manha.
--
-- 7:30 abre o dia; 11:30, 15:30 e 19:30 carregam so o que vem pela frente ate
-- a janela seguinte. As tres do meio nao saem quando nao ha nada pendente a
-- frente: mensagem vazia de hora em hora vira papel de parede.
--
-- Os horarios aqui estao em UTC. Sao Paulo e UTC-3 o ano inteiro, porque o
-- horario de verao brasileiro foi extinto em 2019 — por isso nao ha ajuste
-- sazonal nenhum nestas expressoes.
--
-- Os tres jobs nascem DESLIGADOS de proposito. A funcao whatsapp-agenda
-- precisa estar publicada com o codigo das janelas antes de eles dispararem,
-- senao a versao antiga recebe modo=diario no meio da tarde. Ligar depois do
-- deploy, com cron.alter_job(..., active := true).

do $$
declare
  cmd text := (select command from cron.job where jobname = 'whatsapp-resumo-diario');
  j record;
begin
  if cmd is null then
    raise notice 'whatsapp-resumo-diario nao existe; janelas do coach nao agendadas';
    return;
  end if;

  for j in
    select * from (values
      ('whatsapp-coach-meio-dia', '30 14 * * *'),  -- 11:30 America/Sao_Paulo
      ('whatsapp-coach-tarde',    '30 18 * * *'),  -- 15:30
      ('whatsapp-coach-noite',    '30 22 * * *')   -- 19:30
    ) as t(nome, agenda)
  loop
    perform cron.unschedule(j.nome) where exists (select 1 from cron.job where jobname = j.nome);
    perform cron.schedule(j.nome, j.agenda, cmd);
    perform cron.alter_job((select jobid from cron.job where jobname = j.nome), active := false);
  end loop;
end $$;

-- O limite agora e orcamento por campo (primeiro passo, versao minima, frase),
-- nao o tamanho da mensagem inteira: o codigo monta o texto, o modelo so
-- preenche os campos. 1200 da cerca de 130 caracteres por campo.
UPDATE public.coach_perfil SET limite_caracteres = 1200 WHERE id = 1;
