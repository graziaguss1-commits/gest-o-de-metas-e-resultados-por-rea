import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LinhasCoach = {
  primeiroPasso: string | null;
  versaoMinima: string | null;
  frase: string | null;
};

/**
 * O que o coach escreveu para os blocos de um dia, indexado pela referência.
 *
 * Cobertura é parcial de propósito: cada mensagem carrega no máximo três
 * horários, então bloco que nunca entrou numa janela não tem linha aqui. A
 * tela mostra o que existe em vez de inventar — e o texto que ela mesma
 * escreveu na tarefa continua ganhando deste.
 */
export function useLinhasCoach(data: string) {
  return useQuery({
    queryKey: ["linhas-coach", data],
    queryFn: async () => {
      const { data: linhas, error } = await supabase
        .from("coach_frases")
        .select("referencia, primeiro_passo, versao_minima, frase, created_at")
        .eq("data", data)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // A mais recente vence: se o mesmo bloco apareceu em duas janelas, o
      // texto da janela mais nova é o que ela acabou de receber.
      const mapa = new Map<string, LinhasCoach>();
      for (const l of linhas ?? []) {
        mapa.set(l.referencia, {
          primeiroPasso: l.primeiro_passo,
          versaoMinima: l.versao_minima,
          frase: l.frase,
        });
      }
      return mapa;
    },
  });
}
