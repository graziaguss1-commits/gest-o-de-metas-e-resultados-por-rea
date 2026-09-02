import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const CONNECTOR_ID = "google_calendar";
const OAUTH_CHANNEL = "google-calendar-oauth";
const OAUTH_RESULT_KEY = "google-calendar-oauth-result";

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
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(OAUTH_CHANNEL);
    let closedAt: number | null = null;
    let checkingStatus = false;

    function cleanup() {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(poll);
      window.clearInterval(statusPoll);
      window.clearTimeout(timeout);
      channel?.close();
    }

    function finish(payload: unknown) {
      const result = payload as {
        type?: string;
        connectorId?: string;
        reason?: string;
      } | null;
      const type = result?.type;
      if (
        result?.connectorId !== CONNECTOR_ID ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      ) return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") {
        popup.close();
        resolve();
        return;
      }
      popup.close();
      reject(new Error(result?.reason ?? "A conexão com o Google não foi concluída."));
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      finish(event.data);
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== OAUTH_RESULT_KEY || !event.newValue) return;
      try {
        finish(JSON.parse(event.newValue));
      } catch {
        // Ignora mensagens inválidas de outras abas.
      }
    }

    const poll = window.setInterval(() => {
      if (!popup.closed) {
        closedAt = null;
        return;
      }
      closedAt ??= Date.now();
      if (Date.now() - closedAt < 1_500) return;
      cleanup();
      reject(new Error("A aba do Google foi fechada antes de concluir."));
    }, 500);

    const timeout = window.setTimeout(() => {
      cleanup();
      popup.close();
      reject(new Error("A autorização do Google expirou. Tente conectar novamente."));
    }, 10 * 60_000);

    const statusPoll = window.setInterval(() => {
      if (checkingStatus) return;
      checkingStatus = true;
      void supabase.functions.invoke("google-calendar-status")
        .then(({ data, error }) => {
          if (!error && data?.success && data?.connected && !data?.needs_reconnect) {
            finish({ type: "appUserConnectorOAuthComplete", connectorId: CONNECTOR_ID });
          }
        })
        .catch(() => undefined)
        .finally(() => { checkingStatus = false; });
    }, 2_500);

    channel?.addEventListener("message", (event) => finish(event.data));
    window.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
  });
}

export function useConectarGoogleCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        window.localStorage.removeItem(OAUTH_RESULT_KEY);
      } catch {
        // O fluxo também funciona por BroadcastChannel e postMessage.
      }
      const popup = window.open(
        "/oauth/google-calendar/start",
        "_blank",
        "popup,width=600,height=720",
      );
      if (!popup) throw new Error("Nova aba bloqueada. Permita popups e tente novamente.");
      await waitForOAuthCompletion(popup);
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
