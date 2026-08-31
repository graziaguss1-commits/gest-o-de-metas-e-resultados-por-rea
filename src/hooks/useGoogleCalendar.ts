import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const CONNECTOR_ID = "google_calendar";

export type GoogleCalendarStatus = {
  connected: boolean;
  needs_reconnect: boolean;
  google_email: string | null;
  calendar_id: string;
  calendar_timezone: string | null;
  last_sync_at: string | null;
};

export type GoogleCalendarOption = {
  id: string;
  summary: string;
  primary: boolean;
  timeZone: string | null;
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
        needs_reconnect: Boolean(data.needs_reconnect),
        google_email: data.google_email ?? null,
        calendar_id: data.calendar_id ?? "primary",
        calendar_timezone: data.calendar_timezone ?? null,
        last_sync_at: data.last_sync_at ?? null,
      };
    },
  });
}

export function useGoogleCalendarList(enabled = true) {
  return useQuery({
    queryKey: ["google-calendar-list"],
    enabled,
    queryFn: async (): Promise<GoogleCalendarOption[]> => {
      const { data, error } = await supabase.functions.invoke("google-calendar-calendars");
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Falha ao listar calendários.");
      return (data.calendars ?? []) as GoogleCalendarOption[];
    },
  });
}

export function useSelecionarCalendarioGoogle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (calendarId: string) => {
      const { data, error } = await supabase.functions.invoke("google-calendar-calendars", {
        method: "POST",
        body: { calendar_id: calendarId },
      });
      if (error || !data?.success) {
        throw new Error(data?.error ?? "Não foi possível trocar o calendário de destino.");
      }
      const sync = await supabase.functions.invoke("google-calendar-sync");
      if (sync.error || !sync.data?.success) {
        throw new Error("Calendário alterado, mas a sincronização precisa ser repetida.");
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] }),
        queryClient.invalidateQueries({ queryKey: ["google-calendar-list"] }),
        queryClient.invalidateQueries({ queryKey: ["google-busy-blocks"] }),
      ]);
    },
  });
}

export type GoogleBusyBlock = {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
};

/** Intervalos do Google; conteúdo e participantes nunca são lidos pelo navegador. */
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
      if (error) throw error;
      return (data ?? []) as GoogleBusyBlock[];
    },
  });
}

function waitForOAuthCompletion(popup: Window) {
  return new Promise<void>((resolve, reject) => {
    function cleanup() {
      window.removeEventListener("message", onMessage);
      window.clearInterval(poll);
    }
    function onMessage(event: MessageEvent) {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        event.data?.connectorId !== CONNECTOR_ID ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      ) return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") {
        resolve();
        return;
      }
      popup.close();
      reject(new Error(event.data?.reason ?? "A conexão com o Google não foi concluída."));
    }
    const poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("A janela do Google foi fechada antes de concluir."));
    }, 500);
    window.addEventListener("message", onMessage);
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
        queryClient.invalidateQueries({ queryKey: ["google-calendar-list"] }),
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
        queryClient.invalidateQueries({ queryKey: ["agendamentos"] }),
        queryClient.invalidateQueries({ queryKey: ["compromissos"] }),
        queryClient.invalidateQueries({ queryKey: ["acoes-avulsas"] }),
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
        queryClient.invalidateQueries({ queryKey: ["google-calendar-list"] }),
        queryClient.invalidateQueries({ queryKey: ["google-busy-blocks"] }),
      ]);
    },
  });
}

export function useAutoSyncGoogleCalendar(chave: string, ativo: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!ativo) return;
    let cancelado = false;
    void supabase.functions.invoke("google-calendar-sync").then(({ data, error }) => {
      if (cancelado || error || !data?.success) return;
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["google-busy-blocks"] }),
        queryClient.invalidateQueries({ queryKey: ["agendamentos"] }),
        queryClient.invalidateQueries({ queryKey: ["compromissos"] }),
        queryClient.invalidateQueries({ queryKey: ["acoes-avulsas"] }),
      ]);
    }).catch(() => undefined);
    return () => { cancelado = true; };
  }, [chave, ativo, queryClient]);
}
