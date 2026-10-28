import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgendaPeriodo } from "@/hooks/useAgendaDoDia";
import { usePrioridadesDia } from "@/hooks/usePrioridadeDia";
import { isoLocal, referenciaBloco, segundaDaSemana } from "@/lib/hoje";
import { cn } from "@/lib/utils";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const somaDias = (iso: string, dias: number) => {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return isoLocal(new Date(ano, mes - 1, dia + dias));
};

/**
 * A prioridade de cada dia da semana corrente.
 *
 * Substituiu o cartão das "3 prioridades top", que lia o planejamento
 * semanal. As 3 saíram do app: a semana decide o que entra, o dia decide o
 * que se defende. Dia em branco é estado normal, nunca pendência — por isso
 * nada aqui fica vermelho nem cobra preenchimento.
 */
export function PrioridadeDeCadaDia() {
  const hoje = isoLocal(new Date());
  const inicio = useMemo(() => isoLocal(segundaDaSemana(new Date())), []);
  const fim = useMemo(() => somaDias(inicio, 6), [inicio]);

  const { blocos, isLoading } = useAgendaPeriodo(inicio, fim);
  const { data: escolhidas, isLoading: carregandoEscolhas } =
    usePrioridadesDia(inicio, fim);

  // A escolha guarda a REFERÊNCIA do bloco, não o título: o nome vem da
  // agenda, para um bloco renomeado não deixar o cartão com o texto velho.
  const tituloPorReferencia = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const bloco of blocos) {
      const ref = referenciaBloco(bloco);
      if (ref) mapa.set(ref, `${bloco.inicio} · ${bloco.titulo}`);
    }
    return mapa;
  }, [blocos]);

  if (isLoading || carregandoEscolhas) {
    return <Skeleton className="h-28 w-full" />;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {DIAS.map((nome, i) => {
        const iso = somaDias(inicio, i);
        const ehHoje = iso === hoje;
        const referencia = escolhidas?.get(iso);
        const titulo = referencia
          ? (tituloPorReferencia.get(referencia) ?? "Bloco removido da agenda")
          : null;
        return (
          <div
            key={iso}
            className={cn(
              "rounded-xl border p-3",
              ehHoje
                ? "border-[var(--brand-accent)] bg-[var(--brand-accent-soft)]"
                : "bg-card",
            )}
          >
            <div className="flex items-center gap-1.5">
              <Star
                aria-hidden="true"
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  titulo
                    ? "fill-current text-[var(--brand-accent)]"
                    : "text-muted-foreground/40",
                )}
              />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {nome}
                {ehHoje && " · hoje"}
              </span>
            </div>
            <p
              className={cn(
                "mt-1.5 line-clamp-2 min-h-8 text-xs leading-snug",
                titulo ? "font-semibold" : "text-muted-foreground",
              )}
            >
              {titulo ?? "Sem prioridade definida"}
            </p>
          </div>
        );
      })}
      <Link
        to="/planejamento-semanal"
        className="flex items-center justify-center rounded-xl border border-dashed p-3 text-xs font-semibold text-[var(--brand-primary)] transition hover:bg-muted/40"
      >
        Definir no planejamento →
      </Link>
    </div>
  );
}
