import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const CONNECTOR_ID = "google_calendar";
const OAUTH_CHANNEL = "google-calendar-oauth";
const OAUTH_RESULT_KEY = "google-calendar-oauth-result";

type OAuthFailure = {
  type: "appUserConnectorOAuthFailed";
  connectorId: typeof CONNECTOR_ID;
  reason: string;
  timestamp: number;
};

function notifyFailure(reason: string) {
  const payload: OAuthFailure = {
    type: "appUserConnectorOAuthFailed",
    connectorId: CONNECTOR_ID,
    reason,
    timestamp: Date.now(),
  };
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
}

export default function GoogleCalendarStart() {
  const [error, setError] = useState<string | null>(null);
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        if (window.self !== window.top) {
          setEmbedded(true);
          setError("O Google exige que a autorização seja aberta fora da prévia incorporada.");
          return;
        }
        const { data, error: invokeError } = await supabase.functions.invoke("google-oauth-start", {
          body: { origin: window.location.origin },
        });
        if (invokeError || !data?.success || typeof data.authorizationUrl !== "string") {
          throw new Error(data?.error ?? "Não foi possível iniciar a conexão com o Google.");
        }
        const authorizationUrl = new URL(data.authorizationUrl);
        if (authorizationUrl.protocol !== "https:") {
          throw new Error("O endereço de autorização retornado é inválido.");
        }
        if (!cancelled) window.location.replace(authorizationUrl.toString());
      } catch (cause) {
        if (cancelled) return;
        const reason = cause instanceof Error ? cause.message : "Não foi possível iniciar a conexão com o Google.";
        setError(reason);
        notifyFailure(reason);
      }
    }

    void start();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        {error ? (
          <>
            <p className="text-sm font-medium">Não foi possível abrir o Google</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            {embedded ? (
              <Button asChild variant="outline">
                <a href={window.location.href} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Abrir em nova aba
                </a>
              </Button>
            ) : (
              <Button variant="outline" onClick={() => window.location.reload()}>
                <ExternalLink className="mr-2 h-4 w-4" /> Tentar novamente
              </Button>
            )}
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Abrindo o Google Agenda em uma aba segura…</p>
          </>
        )}
      </div>
    </main>
  );
}
