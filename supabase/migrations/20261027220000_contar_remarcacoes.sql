-- Quantas vezes um bloco foi empurrado para outro dia.
--
-- Ela pediu que o coach reconheca o padrao "faco isso primeiro, depois faco".
-- Ate agora remarcar sobrescrevia a data e nao deixava rastro, entao o padrao
-- era invisivel para o sistema.
--
-- Conta no banco, por trigger, e nao no app: remarcar acontece por varios
-- caminhos (arrastar na aba Hoje, arrastar no calendario, o botao de
-- remarcar), e contar em cada um deles daria divergencia na primeira vez que
-- alguem esquecesse um. Aqui nao tem como escapar.
--
-- So conta quando a data anda para FRENTE. Arrastar dentro do mesmo dia e
-- reorganizar a agenda, nao adiar — e marcar os dois como a mesma coisa
-- encheria a contagem de ruido ate ela deixar de significar nada.
--
-- Sem retroativo: o historico de remarcacoes anteriores nao existe.

ALTER TABLE public.tarefa_agendamentos
  ADD COLUMN IF NOT EXISTS remarcacoes integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.tg_contar_remarcacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.data > OLD.data THEN
    NEW.remarcacoes := COALESCE(OLD.remarcacoes, 0) + 1;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS contar_remarcacao ON public.tarefa_agendamentos;
CREATE TRIGGER contar_remarcacao BEFORE UPDATE ON public.tarefa_agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_contar_remarcacao();
