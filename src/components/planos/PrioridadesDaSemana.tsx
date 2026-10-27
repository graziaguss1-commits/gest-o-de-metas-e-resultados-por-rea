import { useMemo } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { useAgendaPeriodo } from "@/hooks/useAgendaDoDia";
import { useDefinirPrioridadeDia, usePrioridadesDia } from "@/hooks/usePrioridadeDia";
import { isoLocal, referenciaBloco } from "@/lib/hoje";

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const diaDoISO = (inicioISO: string, offset: number) => {
  const [ano, mes, dia] = inicioISO.split("-").map(Number);
  return isoLocal(new Date(ano, mes - 1, dia + offset));
};

const curto = (iso: string) => {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
};

/**
 * Uma prioridade por dia da semana.
 *
 * Todos os dias são opcionais de propósito: ela pode definir só a de hoje e
 * voltar amanhã. Dia em branco é estado normal, não pendência — por isso
 * nenhuma linha aqui fica vermelha nem cobra preenchimento.
 *
 * A escolha aponta para um BLOCO, não para a tarefa, então um dia só tem
 * opções depois que os horários daquele dia foram reservados. É também o que
 * permite que compromisso e ação avulsa sejam a prioridade, coisa que o top 3
 * antigo não permitia: ele só conhecia tarefa de plano.
 */
export function PrioridadesDaSemana({ inicioSemana }: { inicioSemana: string }) {
  const dias = useMemo(
    () => DIAS.map((nome, i) => ({ nome, iso: diaDoISO(inicioSemana, i) })),
    [inicioSemana],
  );
  const fimSemana = dias[6].iso;

  const { blocos, isLoading } = useAgendaPeriodo(inicioSemana, fimSemana);
  const { data: escolhidas } = usePrioridadesDia(inicioSemana, fimSemana);
  const definir = useDefinirPrioridadeDia();

  const porDia = useMemo(() => {
    const mapa = new Map<string, typeof blocos>();
    for (const bloco of blocos) {
      // Horário ocupado do Google não é tarefa dela: não pode ser prioridade.
      if (!referenciaBloco(bloco)) continue;
      const lista = mapa.get(bloco.data);
      if (lista) lista.push(bloco);
      else mapa.set(bloco.data, [bloco]);
    }
    for (const lista of mapa.values()) lista.sort((a, b) => a.inicio.localeCompare(b.inicio));
    return mapa;
  }, [blocos]);

  const escolher = (data: string, referencia: string) => {
    definir.mutate(
      { data, referencia: referencia || null },
      {
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "Não foi possível salvar a prioridade."),
      },
    );
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando a agenda da semana…</p>;
  }

  return (
    <div className="space-y-2">
      {dias.map(({ nome, iso }) => {
        const opcoes = porDia.get(iso) ?? [];
        const atual = escolhidas?.get(iso) ?? "";
        return (
          <div
            key={iso}
            className="flex flex-wrap items-center gap-2 rounded-xl border p-3"
          >
            <Star
              aria-hidden="true"
              className={`h-4 w-4 shrink-0 ${atual ? "fill-current text-[var(--brand-accent)]" : "text-muted-foreground/40"}`}
            />
            <span className="w-28 shrink-0 text-sm font-semibold">
              {nome}
              <span className="ml-1 font-normal text-muted-foreground">{curto(iso)}</span>
            </span>
            {opcoes.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                Sem blocos reservados neste dia ainda.
              </span>
            ) : (
              <select
                aria-label={`Prioridade de ${nome}`}
                value={atual}
                disabled={definir.isPending}
                onChange={(e) => escolher(iso, e.target.value)}
                className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs"
              >
                <option value="">Sem prioridade definida</option>
                {opcoes.map((bloco) => {
                  const ref = referenciaBloco(bloco);
                  return ref ? (
                    <option key={bloco.id} value={ref}>
                      {bloco.inicio} · {bloco.titulo}
                    </option>
                  ) : null;
                })}
              </select>
            )}
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">
        Pode deixar em branco. Defina só a de hoje se preferir e volte amanhã —
        nada aqui fica pendente por estar vazio.
      </p>
    </div>
  );
}
