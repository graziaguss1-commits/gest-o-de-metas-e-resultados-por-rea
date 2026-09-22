import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "A autorização foi cancelada no Google.",
  invalid_oauth_state: "A autorização expirou. Inicie a conexão novamente.",
  missing_code: "O Google não retornou a autorização necessária.",
  oauth_complete_failed: "Não foi possível concluir a conexão com o Google Agenda.",
};

export default function GoogleCalendarReturn() {
  const [message, setMessage] = useState("Finalizando a conexão com o Google Agenda…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let redirectTimer: number | undefined;
    let cancelled = false;
    const fail = (reason: string) => {
      if (cancelled) return;
      setMessage(reason);
      setFailed(true);
    };

    if (params.get("success") !== "true") {
      const code = params.get("error") ?? "oauth_complete_failed";
      fail(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.oauth_complete_failed);
      return;
    }

    const finishConnection = async () => {
      const legacyCode = params.get("code");
      const legacyState = params.get("gstate");

      // Compatibilidade temporária com o Connector Gateway que ainda pode estar
      // publicado no Lovable Cloud. O OAuth direto já conclui esta etapa no
      // callback server-side e, por isso, não envia code/gstate para o navegador.
      if (legacyCode || legacyState) {
        if (!legacyCode) {
          throw new Error("O Google não retornou o código necessário para concluir a conexão.");
        }
        // O Connector Gateway atual devolve somente o código de troca. Versões
        // anteriores também preservavam o gstate; enviá-lo quando existir mantém
        // compatibilidade com as duas versões da função publicada.
        const body = legacyState
          ? { code: legacyCode, state: legacyState }
          : { code: legacyCode };
        const { data, error } = await supabase.functions.invoke("google-oauth-complete", {
          body,
        });
        if (error || !data?.success) {
          throw new Error(data?.error ?? "Não foi possível concluir a conexão.");
        }
      }

      if (cancelled) return;
      const warning = params.get("sync_warning") === "true";
      setMessage(
        warning
          ? "Google Agenda conectado. A primeira sincronização será repetida nas configurações…"
          : "Google Agenda conectado. Voltando às configurações…",
      );
      redirectTimer = window.setTimeout(() => {
        window.location.replace("/configuracoes/google-calendar?google_calendar=connected");
      }, 700);
    };

    void finishConnection().catch((error) => {
      fail(error instanceof Error ? error.message : ERROR_MESSAGES.oauth_complete_failed);
    });

    return () => {
      cancelled = true;
      if (redirectTimer !== undefined) window.clearTimeout(redirectTimer);
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-sm space-y-4 text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
        {failed && (
          <Button asChild variant="outline">
            <Link to="/configuracoes/google-calendar">Voltar às configurações</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
