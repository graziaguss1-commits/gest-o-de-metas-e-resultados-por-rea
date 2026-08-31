import { useState } from "react";
import { CalendarSync, Check, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useConectarGoogleCalendar,
  useDesconectarGoogleCalendar,
  useGoogleCalendarStatus,
  useSincronizarGoogleCalendar,
} from "@/hooks/useGoogleCalendar";

/**
 * Card individual de conexão com o Google Agenda: cada usuário conecta a
 * própria conta. Tokens ficam no Connector Gateway; o app armazena apenas a
 * chave criptografada por usuário.
 */
export function GoogleCalendarConnect() {
  const { data: status, isLoading } = useGoogleCalendarStatus();
  const conectar = useConectarGoogleCalendar();
  const sincronizar = useSincronizarGoogleCalendar();
  const desconectar = useDesconectarGoogleCalendar();
  const [confirmando, setConfirmando] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-24 w-full max-w-2xl" />;
  }

  const connected = status?.connected ?? false;
  const pending = conectar.isPending || sincronizar.isPending || desconectar.isPending;

  const handleConnect = async () => {
    try {
      await conectar.mutateAsync();
      toast.success("Google Agenda conectado. Sincronização inicial concluída.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível conectar.");
    }
  };

  const handleSync = async () => {
    try {
      const result = await sincronizar.mutateAsync();
      toast.success(
        `Sincronizado: ${result.busy_upserts ?? 0} horários ocupados, ${result.eventos_criados ?? 0} eventos enviados ao Google.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao sincronizar.");
    }
  };

  const handleDisconnect = async () => {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    try {
      await desconectar.mutateAsync();
      toast.success("Google Agenda desconectado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao desconectar.");
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <div className="metasia-card max-w-2xl p-4 flex items-center gap-4">
      <div
        className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
        style={{
          backgroundColor: connected ? "var(--color-green-bg)" : "var(--color-blue-soft)",
        }}
      >
        <CalendarSync
          className="h-5 w-5"
          style={{ color: connected ? "var(--color-green)" : "var(--color-blue)" }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-sm">Google Agenda</h3>
          {connected ? (
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1"
              style={{ backgroundColor: "var(--color-green-bg)", color: "var(--color-green)" }}
            >
              <Check className="h-2.5 w-2.5" /> conectado
            </span>
          ) : (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-muted text-muted-foreground">
              <X className="h-2.5 w-2.5" /> desconectado
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {connected
            ? `Conta ${status?.google_email ?? "Google"} sincronizada${
                status?.last_sync_at
                  ? ` · última sync ${new Date(status.last_sync_at).toLocaleString("pt-BR")}`
                  : ""
              }. Seus agendamentos aparecem no Google e horários ocupados do Google bloqueiam sua agenda aqui.`
            : "Conecte sua conta Google pessoal: suas ações agendadas viram eventos no Google Agenda e seus compromissos do Google aparecem aqui como horários ocupados (sem títulos)."}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
        {connected && (
          <>
            <Button size="sm" variant="outline" disabled={pending} onClick={handleSync}>
              {sincronizar.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Sincronizar
            </Button>
            <Button
              size="sm"
              variant={confirmando ? "destructive" : "outline"}
              disabled={pending}
              onClick={handleDisconnect}
              onBlur={() => setConfirmando(false)}
            >
              {confirmando ? "Confirmar" : "Desconectar"}
            </Button>
          </>
        )}
        {!connected && (
          <Button
            size="sm"
            disabled={pending}
            onClick={handleConnect}
            style={{ backgroundColor: "var(--color-blue)", color: "white" }}
            className="hover:opacity-90"
          >
            {conectar.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Conectar Google Agenda
          </Button>
        )}
      </div>
    </div>
  );
}
