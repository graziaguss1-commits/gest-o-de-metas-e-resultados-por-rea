import { useEffect, useMemo, useRef } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BlocoAgendaDia } from "@/hooks/useAgendaDoDia";
import {
  formatDuracao,
  horarioEmMinutos,
  horariosLivres,
  minutosEmHorario,
} from "@/lib/agenda";

const INICIO_DIA = 6 * 60;
const FIM_DIA = 22 * 60;
const ALTURA_HORA = 32;
const ALTURA_TOTAL = ((FIM_DIA - INICIO_DIA) / 60) * ALTURA_HORA;

type Props = {
  data: string;
  hora: string;
  duracao: number | null;
  tituloNovoBloco: string;
  blocos: BlocoAgendaDia[];
  isLoading: boolean;
  conflito?: BlocoAgendaDia;
  onSelectHora: (hora: string) => void;
};

const estiloTipo: Record<BlocoAgendaDia["tipo"], string> = {
  plano:
    "border-[var(--brand-primary)]/35 bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]",
  avulsa:
    "border-[var(--color-green)]/35 bg-[var(--color-green-bg)] text-[var(--color-green)]",
  compromisso:
    "border-[var(--brand-accent)]/40 bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]",
};

function posicaoVisual(inicio: string, fim: string) {
  const inicioMinutos = horarioEmMinutos(inicio);
  const fimMinutos = horarioEmMinutos(fim);
  const visualInicio = Math.max(INICIO_DIA, inicioMinutos);
  const visualFim = Math.min(FIM_DIA, fimMinutos);
  if (
    !Number.isFinite(inicioMinutos) ||
    !Number.isFinite(fimMinutos) ||
    visualFim <= visualInicio
  ) {
    return null;
  }
  return {
    top: ((visualInicio - INICIO_DIA) / 60) * ALTURA_HORA,
    height: Math.max(22, ((visualFim - visualInicio) / 60) * ALTURA_HORA),
  };
}

function amostrarHorarios(horarios: string[], limite = 8) {
  if (horarios.length <= limite) return horarios;
  return Array.from(
    new Set(
      Array.from(
        { length: limite },
        (_, index) =>
          horarios[Math.round((index * (horarios.length - 1)) / (limite - 1))],
      ),
    ),
  );
}

export function AgendaDiaPreview({
  data,
  hora,
  duracao,
  tituloNovoBloco,
  blocos,
  isLoading,
  conflito,
  onSelectHora,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const fimNovoBloco =
    duracao && hora ? minutosEmHorario(horarioEmMinutos(hora) + duracao) : "";
  const posicaoNovoBloco =
    duracao && hora ? posicaoVisual(hora, fimNovoBloco) : null;
  const topNovoBloco = posicaoNovoBloco?.top;
  const totalPlanejado = blocos.reduce((total, bloco) => {
    const inicio = horarioEmMinutos(bloco.inicio);
    const fim = horarioEmMinutos(bloco.fim);
    return (
      total +
      (Number.isFinite(inicio) && Number.isFinite(fim)
        ? Math.max(0, fim - inicio)
        : 0)
    );
  }, 0);
  const sugestoes = useMemo(
    () =>
      duracao
        ? amostrarHorarios(
            horariosLivres(
              duracao,
              blocos.map((bloco) => ({ inicio: bloco.inicio, fim: bloco.fim })),
            ),
          )
        : [],
    [blocos, duracao],
  );

  useEffect(() => {
    if (!scrollRef.current || topNovoBloco == null) return;
    scrollRef.current.scrollTop = Math.max(0, topNovoBloco - 110);
  }, [data, hora, topNovoBloco]);

  const dataFormatada = data
    ? new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      })
    : "Escolha uma data";

  return (
    <aside className="rounded-2xl border bg-muted/20 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--brand-primary)]">
            <CalendarDays className="h-3.5 w-3.5" />
            Agenda do dia
          </div>
          <div className="mt-1 text-sm font-semibold capitalize">
            {dataFormatada}
          </div>
        </div>
        {!isLoading && (
          <div className="shrink-0 text-right text-[10px] text-muted-foreground">
            <div>
              {blocos.length} {blocos.length === 1 ? "bloco" : "blocos"}
            </div>
            <div>{formatDuracao(totalPlanejado) ?? "0h"} ocupadas</div>
          </div>
        )}
      </div>

      {!data ? (
        <div className="mt-3 flex h-36 items-center justify-center rounded-xl border border-dashed px-6 text-center text-xs text-muted-foreground">
          Escolha o dia para carregar os compromissos e os horários livres.
        </div>
      ) : isLoading ? (
        <div className="flex h-48 items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando sua agenda…
        </div>
      ) : (
        <>
          {blocos.length === 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--color-green)]/25 bg-[var(--color-green-bg)] p-2.5 text-xs text-[var(--color-green)]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Sua agenda está livre neste dia.
            </div>
          )}

          <div
            ref={scrollRef}
            className="mt-3 max-h-[350px] overflow-y-auto rounded-xl border bg-background"
          >
            <div className="relative" style={{ height: ALTURA_TOTAL }}>
              {Array.from({ length: 17 }, (_, index) => {
                const minutos = INICIO_DIA + index * 60;
                return (
                  <div
                    key={minutos}
                    className="absolute left-0 right-0 flex items-start"
                    style={{ top: index * ALTURA_HORA }}
                  >
                    <span className="w-12 -translate-y-1/2 pr-2 text-right text-[9px] tabular-nums text-muted-foreground">
                      {minutosEmHorario(minutos)}
                    </span>
                    <span className="mt-px flex-1 border-t border-dashed" />
                  </div>
                );
              })}

              {blocos.map((bloco) => {
                const posicao = posicaoVisual(bloco.inicio, bloco.fim);
                if (!posicao) return null;
                return (
                  <div
                    key={bloco.id}
                    title={`${bloco.inicio}–${bloco.fim} · ${bloco.titulo} · ${bloco.detalhe}`}
                    className={`absolute left-[52px] right-2 z-10 overflow-hidden rounded-md border px-2 py-1 text-[9px] shadow-sm ${estiloTipo[bloco.tipo]} ${bloco.concluido ? "opacity-55" : ""}`}
                    style={posicao}
                  >
                    <div
                      className={`truncate font-semibold text-foreground ${bloco.concluido ? "line-through" : ""}`}
                    >
                      <span className="font-bold tabular-nums">
                        {bloco.inicio}–{bloco.fim}
                      </span>{" "}
                      · {bloco.titulo}
                    </div>
                  </div>
                );
              })}

              {posicaoNovoBloco && (
                <div
                  className={`absolute left-[48px] right-1 z-20 overflow-hidden rounded-md border-2 px-2 py-1 text-[9px] shadow-md ${
                    conflito
                      ? "border-[var(--color-red)] bg-[var(--color-red-bg)] text-[var(--color-red)]"
                      : "border-[var(--brand-accent)] bg-background text-[var(--brand-primary)]"
                  }`}
                  style={posicaoNovoBloco}
                >
                  <div className="truncate font-semibold">
                    <span className="font-bold tabular-nums">
                      {hora}–{fimNovoBloco}
                    </span>{" "}
                    · {tituloNovoBloco}
                  </div>
                </div>
              )}
            </div>
          </div>

          {conflito && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--color-red)]/35 bg-[var(--color-red-bg)] p-2.5 text-xs text-[var(--color-red)]">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Este horário conflita com <strong>{conflito.titulo}</strong> (
                {conflito.inicio}–{conflito.fim}).
              </span>
            </div>
          )}

          <div className="mt-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              {duracao
                ? `Horários livres para ${formatDuracao(duracao)}`
                : "Escolha a duração para ver horários livres"}
            </div>
            {duracao && sugestoes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sugestoes.map((sugestao) => (
                  <Button
                    key={sugestao}
                    type="button"
                    size="sm"
                    variant={
                      hora === sugestao && !conflito ? "default" : "outline"
                    }
                    className="h-7 px-2 text-[10px]"
                    onClick={() => onSelectHora(sugestao)}
                  >
                    {sugestao}
                  </Button>
                ))}
              </div>
            )}
            {duracao && sugestoes.length === 0 && (
              <p className="mt-2 text-xs text-[var(--color-red)]">
                Não há um bloco livre desse tamanho entre 06:00 e 22:00.
              </p>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
