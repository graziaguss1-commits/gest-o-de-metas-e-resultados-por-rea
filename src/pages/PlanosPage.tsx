import { useState } from "react";
import { ListChecks, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlanos } from "@/hooks/usePlanos";
import { PlanoCard } from "@/components/planos/PlanoCard";
import { NovoPlanoModal } from "@/components/planos/NovoPlanoModal";

export default function PlanosPage() {
  const { data: planos, isLoading, isError, refetch } = usePlanos();
  const [novoOpen, setNovoOpen] = useState(false);

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Planos de Ação</h1>
            <p className="text-sm text-muted-foreground">
              {planos?.length ?? 0} {planos?.length === 1 ? "plano" : "planos"} cadastrados
            </p>
          </div>
          <Button
            onClick={() => setNovoOpen(true)}
            style={{ backgroundColor: "var(--color-blue)", color: "white" }}
            className="hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Novo plano
          </Button>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-3">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : isError ? (
          <div className="metasia-card p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Não foi possível carregar os planos.</p>
            <Button variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : !planos || planos.length === 0 ? (
          <EmptyState onNovo={() => setNovoOpen(true)} />
        ) : (
          <div className="grid md:grid-cols-2 gap-3 items-start">
            {planos.map((p) => (
              <PlanoCard key={p.id} plano={p} />
            ))}
          </div>
        )}
      </div>

      <NovoPlanoModal open={novoOpen} onOpenChange={setNovoOpen} />
    </AppShell>
  );
}

function EmptyState({ onNovo }: { onNovo: () => void }) {
  return (
    <div className="metasia-card p-12 flex flex-col items-center text-center space-y-4">
      <div
        className="h-16 w-16 rounded-full flex items-center justify-center"
        style={{ backgroundColor: "var(--color-blue-soft)" }}
      >
        <ListChecks className="h-8 w-8" style={{ color: "var(--color-blue)" }} />
      </div>
      <h2 className="text-lg font-semibold">Nenhum plano de ação ainda</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        Crie planos para organizar entregas vinculadas a metas, ou peça à IA para gerar um
        plano a partir da análise de uma meta em risco.
      </p>
      <Button
        onClick={onNovo}
        style={{ backgroundColor: "var(--color-blue)", color: "white" }}
        className="hover:opacity-90"
      >
        <Plus className="h-4 w-4 mr-1.5" />
        Criar primeiro plano
      </Button>
    </div>
  );
}
