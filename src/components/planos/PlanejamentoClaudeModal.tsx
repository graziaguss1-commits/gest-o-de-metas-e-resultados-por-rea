import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  AgendaClaudeItem,
  PlanejamentoClaudeResponse,
  TarefaPlanejamentoClaude,
} from "@/hooks/usePlanejamentoClaude";
import { formatDuracao } from "@/lib/agenda";

export type PlanejamentoClaudeDraft = {
  focoSemana: string;
  topIds: string[];
  complementaryIds: string[];
  agenda: AgendaClaudeItem[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  applying: boolean;
  error: string | null;
  suggestion: PlanejamentoClaudeResponse | null;
  tasks: TarefaPlanejamentoClaude[];
  weekStart: string;
  weekEnd: string;
  onRetry: () => void;
  onConfirm: (draft: PlanejamentoClaudeDraft) => void;
};

const dedupe = (values: string[]) => [...new Set(values)];

export function PlanejamentoClaudeModal({
  open,
  onOpenChange,
  loading,
  applying,
  error,
  suggestion,
  tasks,
  weekStart,
  weekEnd,
  onRetry,
  onConfirm,
}: Props) {
  const taskById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );
  const [focus, setFocus] = useState("");
  const [topIds, setTopIds] = useState<string[]>([]);
  const [complementaryIds, setComplementaryIds] = useState<string[]>([]);
  const [agenda, setAgenda] = useState<AgendaClaudeItem[]>([]);
  const [enabledAgenda, setEnabledAgenda] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!suggestion) return;
    const top = dedupe(suggestion.prioridades_top).slice(0, 3);
    const complementary = dedupe(suggestion.complementares).filter(
      (id) => !top.includes(id),
    );
    setFocus(suggestion.foco_semana);
    setTopIds(top);
    setComplementaryIds(complementary);
    setAgenda(suggestion.agenda.map((item) => ({ ...item })));
    setEnabledAgenda(new Set(suggestion.agenda.map((_, index) => index)));
  }, [suggestion]);

  const selectedIds = useMemo(
    () => new Set([...topIds, ...complementaryIds]),
    [topIds, complementaryIds],
  );

  const toggleTop = (id: string) => {
    if (topIds.includes(id)) {
      setTopIds((current) => current.filter((item) => item !== id));
      return;
    }
    if (topIds.length >= 3) return;
    setTopIds((current) => [...current, id]);
    setComplementaryIds((current) => current.filter((item) => item !== id));
  };

  const toggleComplementary = (id: string) => {
    if (complementaryIds.includes(id)) {
      setComplementaryIds((current) => current.filter((item) => item !== id));
      return;
    }
    setComplementaryIds((current) => [...current, id]);
    setTopIds((current) => current.filter((item) => item !== id));
  };

  const updateAgenda = (
    index: number,
    patch: Partial<Pick<AgendaClaudeItem, "data" | "hora_inicio">>,
  ) => {
    setAgenda((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  };

  const toggleAgenda = (index: number) => {
    setEnabledAgenda((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const validAgenda = agenda.filter(
    (item, index) =>
      enabledAgenda.has(index) &&
      selectedIds.has(item.task_id) &&
      item.data >= weekStart &&
      item.data <= weekEnd &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(item.hora_inicio),
  );

  const canConfirm =
    !loading &&
    !applying &&
    Boolean(suggestion) &&
    topIds.length > 0 &&
    focus.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !applying && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <Sparkles className="h-5 w-5 text-[var(--brand-accent)]" />
            Planejamento sugerido pelo Claude
          </DialogTitle>
          <DialogDescription>
            Revise prioridades, datas e horários. Nada entra no calendário sem
            sua confirmação.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border bg-[var(--brand-light)] p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent-soft)] text-[var(--brand-primary)]">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <h3 className="mt-4 font-semibold">Montando uma semana possível</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              O Claude está cruzando impacto × esforço, prazos, recorrências,
              duração e os horários já ocupados.
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <AlertTriangle className="mx-auto h-7 w-7 text-destructive" />
            <h3 className="mt-3 font-semibold">Não foi possível gerar a proposta</h3>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <Button className="mt-4" variant="outline" onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
            </Button>
          </div>
        )}

        {!loading && suggestion && (
          <div className="space-y-5">
            <div className="rounded-2xl border bg-[var(--brand-light)] p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-green)]" />
                <div>
                  <div className="text-sm font-semibold">Leitura da semana</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {suggestion.resumo}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="claude-week-focus">Foco sugerido</Label>
              <Textarea
                id="claude-week-focus"
                value={focus}
                onChange={(event) => setFocus(event.target.value)}
                rows={2}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                Você pode reescrever essa frase antes de aplicar.
              </p>
            </div>

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Prioridades da semana</h3>
                <p className="text-xs text-muted-foreground">
                  Mantenha até três prioridades top e escolha as complementares
                  que realmente cabem.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {dedupe([
                  ...suggestion.prioridades_top,
                  ...suggestion.complementares,
                ]).map((id) => {
                  const task = taskById.get(id);
                  if (!task) return null;
                  const isTop = topIds.includes(id);
                  const isComplementary = complementaryIds.includes(id);
                  return (
                    <div key={id} className="rounded-xl border p-3">
                      <div className="text-sm font-semibold">{task.descricao}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {task.area} · impacto {task.impacto} · esforço {task.esforco}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={isTop ? "default" : "outline"}
                          onClick={() => toggleTop(id)}
                          disabled={!isTop && topIds.length >= 3}
                        >
                          <Star className={`mr-1.5 h-3.5 w-3.5 ${isTop ? "fill-current" : ""}`} />
                          {isTop ? "Top" : "Marcar top"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={isComplementary ? "secondary" : "ghost"}
                          onClick={() => toggleComplementary(id)}
                        >
                          {isComplementary ? "Complementar" : "Usar como complementar"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Blocos sugeridos</h3>
                  <p className="text-xs text-muted-foreground">
                    Altere o dia ou o horário, ou desmarque o que não quiser
                    agendar agora.
                  </p>
                </div>
                <Badge variant="secondary">{validAgenda.length} selecionados</Badge>
              </div>

              {agenda.length === 0 ? (
                <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                  Não há novos blocos seguros para adicionar. Veja os alertas e
                  ajuste manualmente o que faltar.
                </div>
              ) : (
                <div className="space-y-2">
                  {agenda.map((item, index) => {
                    const task = taskById.get(item.task_id);
                    if (!task) return null;
                    const enabled = enabledAgenda.has(index) && selectedIds.has(item.task_id);
                    return (
                      <div
                        key={`${item.task_id}-${index}`}
                        className={`rounded-xl border p-3 ${enabled ? "bg-card" : "bg-muted/35 opacity-70"}`}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={enabledAgenda.has(index)}
                            onCheckedChange={() => toggleAgenda(index)}
                            aria-label={`Agendar ${task.descricao}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm font-semibold">{task.descricao}</div>
                              <Badge variant="outline">
                                {formatDuracao(item.duracao_minutos)}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.motivo}
                            </p>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Data</Label>
                                <Input
                                  type="date"
                                  min={weekStart}
                                  max={weekEnd}
                                  value={item.data}
                                  disabled={!enabled}
                                  onChange={(event) =>
                                    updateAgenda(index, { data: event.target.value })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Início</Label>
                                <Input
                                  type="time"
                                  step={900}
                                  value={item.hora_inicio}
                                  disabled={!enabled}
                                  onChange={(event) =>
                                    updateAgenda(index, { hora_inicio: event.target.value })
                                  }
                                />
                              </div>
                            </div>
                            {!selectedIds.has(item.task_id) && (
                              <p className="mt-2 text-xs text-[var(--color-amber)]">
                                Selecione esta ação como top ou complementar para
                                incluir o bloco.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {suggestion.alertas.length > 0 && (
              <section className="rounded-xl border border-[var(--color-amber)]/35 bg-[var(--color-amber-bg)]/40 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-amber)]">
                  <AlertTriangle className="h-4 w-4" /> Pontos de atenção
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {suggestion.alertas.map((alert, index) => (
                    <li key={`${alert}-${index}`}>• {alert}</li>
                  ))}
                </ul>
              </section>
            )}

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Gerado por {suggestion.model}. Os horários continuam editáveis no
              calendário.
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
            Cancelar
          </Button>
          {suggestion && !loading && (
            <Button
              className="brand-button"
              disabled={!canConfirm}
              onClick={() =>
                onConfirm({
                  focoSemana: focus.trim(),
                  topIds,
                  complementaryIds,
                  agenda: validAgenda,
                })
              }
            >
              {applying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CalendarClock className="mr-2 h-4 w-4" />
              )}
              {applying ? "Aplicando…" : "Aplicar no planejamento"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
