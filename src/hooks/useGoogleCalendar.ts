import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const CONNECTOR_ID = "google_calendar";

export type GoogleCalendarStatus = {
  connected: boolean;
  google_email: string | null;
  calendar_id: string;
  last_sync_at: string | null;
};

export function useGoogleCalendarStatus(enabled = true) {
  return useQuery({
    queryKey: ["google-calendar-status"],
    enabled,
    queryFn: async (): Promise<GoogleCalendarStatus> => {
      const { data, error } = await supabase.functions.invoke("google-calendar-status");
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Falha ao consultar status.");
      return {
        connected: Boolean(data.connected),
        google_email: data.google_email ?? null,
        calendar_id: data.calendar_id ?? "primary",
        last_sync_at: data.last_sync_at ?? null,
      };
    },
  });
}

export type GoogleBusyBlock = {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
};

/** Intervalos ocupados vindos do Google (sem títulos — privacidade). */
export function useGoogleBusyBlocks(inicio: string, fim: string, enabled = true) {
  return useQuery({
    queryKey: ["google-busy-blocks", inicio, fim],
    enabled,
    queryFn: async (): Promise<GoogleBusyBlock[]> => {
      const { data, error } = await supabase
        .from("google_busy_blocks")
        .select("id, data, hora_inicio, hora_fim")
        .gte("data", inicio)
        .lte("data", fim);
      if (error) return [];
      return (data ?? []) as GoogleBusyBlock[];
    },
  });
}

function waitForOAuthCompletion(popup: Window) {
  return new Promise<void>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        event.data?.connectorId !== CONNECTOR_ID ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      ) {
        return;
      }
      cleanup();
      if (type === "appUserConnectorOAuthComplete") {
        resolve();
        return;
      }
      popup.close();
      reject(new Error(event.data?.reason ?? "A conexão com o Google não foi concluída."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("A janela do Google foi fechada antes de concluir."));
    }, 500);
  });
}

export function useConectarGoogleCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const popup = window.open("", "lovable-oauth", "width=600,height=720");
      if (!popup) throw new Error("Popup bloqueado. Permita popups e tente novamente.");
      try {
        const { data, error } = await supabase.functions.invoke("google-oauth-start", {
          body: { origin: window.location.origin },
        });
        if (error || !data?.success) {
          throw new Error(data?.error ?? "Não foi possível iniciar a conexão com o Google.");
        }
        const completion = waitForOAuthCompletion(popup);
        popup.location.href = data.authorizationUrl;
        await completion;
      } catch (error) {
        popup.close();
        throw error;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] }),
        queryClient.invalidateQueries({ queryKey: ["google-busy-blocks"] }),
      ]);
    },
  });
}

export function useSincronizarGoogleCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-calendar-sync");
      if (error || !data?.success) {
        throw new Error(data?.error ?? "Não foi possível sincronizar com o Google Agenda.");
      }
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] }),
        queryClient.invalidateQueries({ queryKey: ["google-busy-blocks"] }),
      ]);
    },
  });
}

export function useDesconectarGoogleCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-calendar-disconnect");
      if (error || !data?.success) {
        throw new Error(data?.error ?? "Não foi possível desconectar o Google Agenda.");
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] }),
        queryClient.invalidateQueries({ queryKey: ["google-busy-blocks"] }),
      ]);
    },
  });
}
