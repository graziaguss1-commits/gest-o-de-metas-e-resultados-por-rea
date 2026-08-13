import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { useMetas } from "@/hooks/useMetas";
import { ExecucaoConsolidada } from "./ExecucaoConsolidada";
import { StatusChip } from "./StatusChip";
import type { Status } from "@/lib/metas";

/**
 * Bloco de revisão semanal: para cada meta mostra resultado %, execução %,
 * prazo % e o diagnóstico. Indicadores independentes entre si.
 */
export function RevisaoIndicadores() {
  const { data: metas = [], isLoading } = useMetas();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando indicadores…</p>;
  }
  if (metas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma meta cadastrada ainda — crie uma meta para revisar seus indicadores.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {metas.map((meta) => (
        <div key={meta.id} className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{meta.nome}</span>
            <StatusChip status={meta.status as Status} size="sm" />
            <Link
              to={`/metas/${meta.id}/analise`}
              className="ml-auto text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              Atualizar resultado e funil
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <ExecucaoConsolidada meta={meta} />
        </div>
      ))}
    </div>
  );
}
