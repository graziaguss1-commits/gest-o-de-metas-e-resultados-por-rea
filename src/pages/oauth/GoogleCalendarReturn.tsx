import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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
      fail("A autorização no Google não foi concluída.");
      return;
    }
    const code = params.get("code");
    const state = params.get("gstate");
    if (!code || !state) {
      fail("A autorização terminou sem os dados de segurança necessários.");
      return;
    }
    void supabase.functions.invoke("google-oauth-complete", { body: { code, state } })
      .then(({ data, error }) => {
        if (error || !data?.success) throw new Error(data?.error ?? "Não foi possível concluir a conexão.");
        setMessage("Google Agenda conectado. Voltando às configurações…");
        window.location.replace("/configuracoes/google-calendar?google_calendar=connected");
      })
      .catch((err) => {
        const reason = err instanceof Error ? err.message : "Não foi possível concluir a conexão.";
        fail(reason);
      });
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
