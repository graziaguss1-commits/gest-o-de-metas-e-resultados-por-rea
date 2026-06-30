import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { Status } from "@/lib/metas";

type Notif = {
  id: string;
  nome: string;
  status: Status;
  updated_at: string;
};

function useLatestMetaStatusChanges() {
  return useQuery({
    queryKey: ["notifications", "metas-recent"],
    queryFn: async (): Promise<Notif[]> => {
      const { data, error } = await supabase
        .from("metas")
        .select("id, nome, status, updated_at")
        .order("updated_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as Notif[];
    },
    refetchInterval: 60_000,
  });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

const STATUS_ICON: Record<Status, React.ReactNode> = {
  verde: <CheckCircle2 className="h-4 w-4" style={{ color: "var(--color-green)" }} />,
  amarelo: <AlertTriangle className="h-4 w-4" style={{ color: "var(--color-amber)" }} />,
  vermelho: <AlertCircle className="h-4 w-4" style={{ color: "var(--color-red)" }} />,
};

const STATUS_LABEL: Record<Status, string> = {
  verde: "voltou ao prazo",
  amarelo: "entrou em atenção",
  vermelho: "entrou em risco",
};

export function NotificationsDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: notifs, isLoading } = useLatestMetaStatusChanges();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Notificações</SheetTitle>
          <SheetDescription>
            Últimas atualizações de status das suas metas.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 mt-4">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : !notifs || notifs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Sem atividade recente nas suas metas.
            </div>
          ) : (
            <ul className="space-y-1">
              {notifs.map((n) => (
                <li key={n.id}>
                  <Link
                    to={`/metas/${n.id}/analise`}
                    onClick={() => onOpenChange(false)}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="mt-0.5 shrink-0">{STATUS_ICON[n.status]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{n.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {STATUS_LABEL[n.status]} · {relativeTime(n.updated_at)}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
