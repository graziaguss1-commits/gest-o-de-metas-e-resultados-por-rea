import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppSettings } from "@/lib/metas";

const KEY = ["app_settings"] as const;

export function useAppSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<AppSettings> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data as AppSettings;
    },
  });
}

export function useUpdateAppSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<AppSettings>) => {
      const { data, error } = await supabase
        .from("app_settings")
        .update(patch)
        .eq("id", 1)
        .select()
        .single();
      if (error) throw error;
      return data as AppSettings;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Salva o webhook do Slack no Vault e marca slack_webhook_configured=true. */
export function useSaveSlackWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (webhookUrl: string) => {
      if (!webhookUrl.trim()) throw new Error("Informe o webhook.");
      if (!webhookUrl.startsWith("https://hooks.slack.com/")) {
        throw new Error("URL inválida — deve começar com https://hooks.slack.com/");
      }
      const { error: vErr } = await supabase.rpc("store_vault_secret", {
        p_key: "metasia_slack_webhook_url",
        p_value: webhookUrl,
      });
      if (vErr) throw vErr;
      const { error: uErr } = await supabase
        .from("app_settings")
        .update({ slack_webhook_configured: true })
        .eq("id", 1);
      if (uErr) throw uErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Salva a URL da planilha do Google Sheets. */
export function useSaveGoogleSheets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sheetUrl: string) => {
      const trimmed = sheetUrl.trim();
      if (!trimmed) throw new Error("Informe a URL da planilha.");
      if (!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(trimmed)) {
        throw new Error("URL inválida — deve começar com https://docs.google.com/spreadsheets/");
      }
      const { error } = await supabase
        .from("app_settings")
        .update({ gsheets_url: trimmed, gsheets_configured: true })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDisconnectGoogleSheets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("app_settings")
        .update({ gsheets_url: null, gsheets_configured: false })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Conecta a Evolution API (WhatsApp): salva URL base + instância e guarda o token no Vault. */
export function useSaveEvolutionApi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { baseUrl: string; instance: string; apiKey: string }) => {
      const baseUrl = input.baseUrl.trim().replace(/\/+$/, "");
      const instance = input.instance.trim();
      const apiKey = input.apiKey.trim();
      if (!baseUrl) throw new Error("Informe a URL base da Evolution API.");
      if (!/^https?:\/\//.test(baseUrl)) throw new Error("URL base deve começar com http:// ou https://");
      if (!instance) throw new Error("Informe o nome da instância.");
      if (!apiKey) throw new Error("Informe a API key da Evolution.");

      const { error: vErr } = await supabase.rpc("store_vault_secret", {
        p_key: "metasia_evolution_api_key",
        p_value: apiKey,
      });
      if (vErr) throw vErr;

      const { error } = await supabase
        .from("app_settings")
        .update({
          evolution_base_url: baseUrl,
          evolution_instance: instance,
          evolution_configured: true,
        })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDisconnectEvolutionApi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("app_settings")
        .update({
          evolution_base_url: null,
          evolution_instance: null,
          evolution_configured: false,
        })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

