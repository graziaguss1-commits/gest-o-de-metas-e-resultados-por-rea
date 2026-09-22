import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

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
    const fail = (reason: string) => {
      setMessage(reason);
      setFailed(true);
    };

    if (params.get("success") !== "true") {
      const code = params.get("error") ?? "oauth_complete_failed";
      fail(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.oauth_complete_failed);
      return;
    }

    const warning = params.get("sync_warning") === "true";
    setMessage(
      warning
        ? "Google Agenda conectado. A primeira sincronização será repetida nas configurações…"
        : "Google Agenda conectado. Voltando às configurações…",
    );
    const timer = window.setTimeout(() => {
      window.location.replace("/configuracoes/google-calendar?google_calendar=connected");
    }, 700);
    return () => window.clearTimeout(timer);
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
