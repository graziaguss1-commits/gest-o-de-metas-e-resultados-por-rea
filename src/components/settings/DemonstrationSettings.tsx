import { Loader2, Database, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useClearDemoData, useDemoStatus, useLoadDemoData } from "@/hooks/useDemoData";

export default function DemonstrationSettings() {
  const { data: status, isLoading } = useDemoStatus();
  const load = useLoadDemoData();
  const clear = useClearDemoData();

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="metasia-card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: "var(--color-blue-soft)" }}
          >
            <Database className="h-5 w-5" style={{ color: "var(--color-blue)" }} />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="font-semibold">Dados de demonstração</h3>
            <p className="text-sm text-muted-foreground">
              Popule a plataforma com 6 metas fictícias de áreas distintas, lançamentos dos
              últimos 30 dias e 2 planos de ação. Apenas para visualização — não afeta os
              dados reais.
            </p>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : status?.hasDemo ? (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="font-medium mb-1">Dados de demonstração ativos</div>
            <div className="text-xs text-muted-foreground">
              {status.metas} metas · {status.lancamentos} lançamentos · {status.planos} planos
              de ação
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            Nenhum dado de demonstração carregado no momento.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!status?.hasDemo && (
            <Button
              onClick={async () => {
                try {
                  await load.mutateAsync();
                  toast.success("Dados de demonstração carregados");
                } catch (e) {
                  const message = e instanceof Error ? e.message : "Erro ao carregar";
                  toast.error(message);
                }
              }}
              disabled={load.isPending}
              style={{ backgroundColor: "var(--color-blue)", color: "white" }}
              className="hover:opacity-90"
            >
              {load.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Gerando dados…
                </>
              ) : (
                "Carregar dados de demonstração"
              )}
            </Button>
          )}

          {status?.hasDemo && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Limpar dados de demonstração
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar dados de demonstração?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todas as metas, lançamentos e planos marcados como demonstração serão
                    excluídos. Dados reais não serão afetados.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      try {
                        await clear.mutateAsync();
                        toast.success("Dados de demonstração removidos");
                      } catch (e) {
                        const message = e instanceof Error ? e.message : "Erro ao limpar";
                        toast.error(message);
                      }
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Limpar agora
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}
