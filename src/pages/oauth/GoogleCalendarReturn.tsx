import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const CONNECTOR_ID = "google_calendar";

export default function GoogleCalendarReturn() {
  const [message, setMessage] = useState("Finalizando a conexão com o Google Agenda…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notifyOpenerAndClose = (
      type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed",
      reason?: string,
    ) => {
      window.opener?.postMessage(
        { type, connectorId: CONNECTOR_ID, reason },
        window.location.origin,
      );
      window.close();
    };

    if (params.get("success") !== "true") {
      const reason = params.get("error") ?? "A autorização no Google não foi concluída.";
      setMessage(reason);
      notifyOpenerAndClose("appUserConnectorOAuthFailed", reason);
      return;
    }
    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") {
        const reason =
          "Esta conexão ainda não pode ser usada: um administrador precisa habilitar o acesso offline no cliente do App User Connector nas configurações do workspace.";
        setMessage(reason);
        window.opener?.postMessage(
          { type: "appUserConnectorOAuthFailed", connectorId: CONNECTOR_ID, reason },
          window.location.origin,
        );
        return;
      }
      setMessage("A autorização terminou sem um código de troca.");
      notifyOpenerAndClose("appUserConnectorOAuthFailed");
      return;
    }
    void supabase.functions
      .invoke("google-oauth-complete", { body: { code } })
      .then(({ data, error }) => {
        if (error || !data?.success) {
          throw new Error(data?.error ?? "Não foi possível concluir a conexão.");
        }
        notifyOpenerAndClose("appUserConnectorOAuthComplete");
      })
      .catch((err) => {
        const reason = err instanceof Error ? err.message : "Não foi possível concluir a conexão.";
        setMessage(reason);
        notifyOpenerAndClose("appUserConnectorOAuthFailed", reason);
      });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <p className="max-w-sm text-center text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
