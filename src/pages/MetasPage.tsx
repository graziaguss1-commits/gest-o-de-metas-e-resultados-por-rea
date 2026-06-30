import { useMemo, useState } from "react";
import { Plus, Target } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MetaCard } from "@/components/metas/MetaCard";
import { NovaMetaModal } from "@/components/metas/NovaMetaModal";
import { LancarResultadoModal } from "@/components/metas/LancarResultadoModal";
import { HistoricoModal } from "@/components/metas/HistoricoModal";
import { useMetas } from "@/hooks/useMetas";
import { AREAS, PERIODICIDADES, type MetaWithResponsavel, type Status } from "@/lib/metas";
import { cn } from "@/lib/utils";

const STATUS_FILTERS: { value: "todas" | Status; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "verde", label: "No prazo" },
  { value: "amarelo", label: "Em atenção" },
  { value: "vermelho", label: "Em risco" },
];

export default function MetasPage() {
  const { data: metas, isLoading, isError, refetch } = useMetas();
  const [novaOpen, setNovaOpen] = useState(false);
  const [lancarMetaId, setLancarMetaId] = useState<string | undefined>(undefined);
  const [lancarOpen, setLancarOpen] = useState(false);
  const [historicoMeta, setHistoricoMeta] = useState<MetaWithResponsavel | null>(null);

  const [filtroArea, setFiltroArea] = useState<string>("todas");
  const [filtroPeriod, setFiltroPeriod] = useState<string>("todas");
  const [filtroStatus, setFiltroStatus] = useState<"todas" | Status>("todas");

  const filtered = useMemo(() => {
    const items = metas ?? [];
    return items.filter((m) => {
      if (filtroArea !== "todas" && m.area !== filtroArea) return false;
      if (filtroPeriod !== "todas" && m.periodicidade !== filtroPeriod) return false;
      if (filtroStatus !== "todas" && m.status !== filtroStatus) return false;
      return true;
    });
  }, [metas, filtroArea, filtroPeriod, filtroStatus]);

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Minhas Metas</h1>
            <p className="text-sm text-muted-foreground">
              {metas?.length ?? 0} {metas?.length === 1 ? "meta" : "metas"} cadastradas
            </p>
          </div>
          <Button
            onClick={() => setNovaOpen(true)}
            style={{ backgroundColor: "var(--color-blue)", color: "white" }}
            className="hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nova meta
          </Button>
        </div>

        {/* Filtros */}
        <div className="metasia-card p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5 min-w-[160px]">
            <label className="text-xs font-medium text-muted-foreground">Área</label>
            <Select value={filtroArea} onValueChange={setFiltroArea}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as áreas</SelectItem>
                {AREAS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 min-w-[160px]">
            <label className="text-xs font-medium text-muted-foreground">Período</label>
            <Select value={filtroPeriod} onValueChange={setFiltroPeriod}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos os períodos</SelectItem>
                {PERIODICIDADES.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 flex-1 min-w-[220px]">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((f) => {
                const active = filtroStatus === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFiltroStatus(f.value)}
                    className={cn(
                      "text-xs font-medium px-3 py-1.5 rounded-full border transition-colors",
                      active
                        ? "border-transparent text-white"
                        : "border-border bg-card hover:bg-muted/60",
                    )}
                    style={
                      active
                        ? f.value === "todas"
                          ? { backgroundColor: "var(--color-blue)" }
                          : f.value === "verde"
                            ? { backgroundColor: "var(--color-green)" }
                            : f.value === "amarelo"
                              ? { backgroundColor: "var(--color-amber)" }
                              : { backgroundColor: "var(--color-red)" }
                        : undefined
                    }
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="metasia-card p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Não foi possível carregar as metas.</p>
            <Button variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            hasFilters={filtroArea !== "todas" || filtroPeriod !== "todas" || filtroStatus !== "todas"}
            onNova={() => setNovaOpen(true)}
            onClear={() => {
              setFiltroArea("todas");
              setFiltroPeriod("todas");
              setFiltroStatus("todas");
            }}
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((meta) => (
              <MetaCard
                key={meta.id}
                meta={meta}
                onLancarResultado={(m) => {
                  setLancarMetaId(m.id);
                  setLancarOpen(true);
                }}
                onVerHistorico={(m) => setHistoricoMeta(m)}
              />
            ))}
          </div>
        )}
      </div>

      <NovaMetaModal open={novaOpen} onOpenChange={setNovaOpen} />
      <LancarResultadoModal
        open={lancarOpen}
        onOpenChange={(v) => {
          setLancarOpen(v);
          if (!v) setLancarMetaId(undefined);
        }}
        metaId={lancarMetaId}
      />
      <HistoricoModal
        open={!!historicoMeta}
        onOpenChange={(v) => !v && setHistoricoMeta(null)}
        meta={historicoMeta}
      />
    </AppShell>
  );
}

function EmptyState({
  hasFilters,
  onNova,
  onClear,
}: {
  hasFilters: boolean;
  onNova: () => void;
  onClear: () => void;
}) {
  return (
    <div className="metasia-card p-12 flex flex-col items-center text-center space-y-4">
      <div
        className="h-16 w-16 rounded-full flex items-center justify-center"
        style={{ backgroundColor: "var(--color-blue-soft)" }}
      >
        <Target className="h-8 w-8" style={{ color: "var(--color-blue)" }} />
      </div>
      {hasFilters ? (
        <>
          <h2 className="text-lg font-semibold">Nenhuma meta atende a esses filtros</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Ajuste os filtros acima para ver mais resultados ou crie uma nova meta.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClear}>
              Limpar filtros
            </Button>
            <Button
              onClick={onNova}
              style={{ backgroundColor: "var(--color-blue)", color: "white" }}
              className="hover:opacity-90"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Nova meta
            </Button>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold">Nenhuma meta cadastrada ainda</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Crie sua primeira meta para começar a acompanhar resultados, lançar entregas e
            receber análises de saúde com IA.
          </p>
          <Button
            onClick={onNova}
            style={{ backgroundColor: "var(--color-blue)", color: "white" }}
            className="hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Criar primeira meta
          </Button>
        </>
      )}
    </div>
  );
}
