-- Status da meta (verde/amarelo/vermelho) recalculado ao carregar a tela.
--
-- Antes, o status so era recalculado quando alguem lancava um resultado.
-- Meta que nunca recebeu lancamento ficava com a cor do dia em que foi
-- criada: "Marketing" aparecia VERDE com R$ 0 de R$ 20.000 e o prazo
-- inteiro consumido. E o pior tipo de numero errado — nao parece errado,
-- parece tranquilidade.
--
-- A regra de calculo nao e reescrita aqui: reusa calcular_status_meta, que ja
-- existia e e a mesma usada no lancamento. Duas copias dessa regra
-- discordariam no primeiro ajuste de limiar.
--
-- SECURITY INVOKER de proposito: o RLS de metas continua valendo, entao cada
-- pessoa recalcula apenas as metas que ja enxerga. SECURITY DEFINER aqui
-- deixaria qualquer usuario reescrever o status de metas alheias.
--
-- Atualiza so as linhas que mudaram, para carregar a tela nao virar escrita.
-- Metas arquivadas ficam de fora: saíram do painel, nao precisam de cor.

CREATE OR REPLACE FUNCTION public.recalcular_status_metas()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_alteradas integer;
BEGIN
  WITH novos AS (
    SELECT m.id,
           calcular_status_meta(m.valor_atual, m.valor_alvo, m.data_inicio,
                                m.data_fim, m.is_inverse) AS status_novo
      FROM public.metas m
     WHERE m.arquivada_em IS NULL
  )
  UPDATE public.metas m
     SET status = n.status_novo
    FROM novos n
   WHERE n.id = m.id AND m.status IS DISTINCT FROM n.status_novo;

  GET DIAGNOSTICS v_alteradas = ROW_COUNT;
  RETURN v_alteradas;
END $$;

GRANT EXECUTE ON FUNCTION public.recalcular_status_metas() TO authenticated;
