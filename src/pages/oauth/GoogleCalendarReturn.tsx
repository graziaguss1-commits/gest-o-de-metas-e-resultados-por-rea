import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const CONNECTOR_ID = "google_calendar";
const OAUTH_CHANNEL = "google-calendar-oauth";
const OAUTH_RESULT_KEY = "google-calendar-oauth-result";

export default function GoogleCalendarReturn() {
  const [message, setMessage] = useState("Finalizando a conexão com o Google Agenda…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notifyAndClose = (
      type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed",
      reason?: string,
    ) => {
      const payload = { type, connectorId: CONNECTOR_ID, reason, timestamp: Date.now() };
      try {
        window.localStorage.setItem(OAUTH_RESULT_KEY, JSON.stringify(payload));
      } catch {
        // postMessage continua disponível quando o armazenamento estiver bloqueado.
      }
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel(OAUTH_CHANNEL);
        channel.postMessage(payload);
        channel.close();
      }
      window.opener?.postMessage(payload, window.location.origin);
      window.setTimeout(() => window.close(), 150);
    };

    if (params.get("success") !== "true") {
      const reason = "A autorização no Google não foi concluída.";
      setMessage(reason);
      notifyAndClose("appUserConnectorOAuthFailed", reason);
      return;
    }
    const code = params.get("code");
    const state = params.get("gstate");
    if (!code || !state) {
      const reason = "A autorização terminou sem os dados de segurança necessários.";
      setMessage(reason);
      notifyAndClose("appUserConnectorOAuthFailed", reason);
      return;
    }
    void supabase.functions.invoke("google-oauth-complete", { body: { code, state } })
      .then(({ data, error }) => {
        if (error || !data?.success) throw new Error(data?.error ?? "Não foi possível concluir a conexão.");
        setMessage("Google Agenda conectado. Esta aba será fechada automaticamente.");
        notifyAndClose("appUserConnectorOAuthComplete");
      })
      .catch((err) => {
        const reason = err instanceof Error ? err.message : "Não foi possível concluir a conexão.";
        setMessage(reason);
        notifyAndClose("appUserConnectorOAuthFailed", reason);
      });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <p className="max-w-sm text-center text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
