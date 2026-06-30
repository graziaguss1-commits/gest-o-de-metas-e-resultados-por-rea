import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type NotificationTemplate =
  Database["public"]["Tables"]["notification_templates"]["Row"];
export type NotificationTemplateInsert =
  Database["public"]["Tables"]["notification_templates"]["Insert"];
export type NotificationTemplateUpdate =
  Database["public"]["Tables"]["notification_templates"]["Update"];

const KEY = ["notification_templates"] as const;

export function useNotificationTemplates() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<NotificationTemplate[]> => {
      const { data, error } = await supabase
        .from("notification_templates")
        .select("*")
        .order("is_custom", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertNotificationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: NotificationTemplateInsert & { id?: string },
    ): Promise<NotificationTemplate> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const row = {
        ...payload,
        criado_por: payload.criado_por ?? user?.id ?? null,
      };
      if (payload.id) {
        const { data, error } = await supabase
          .from("notification_templates")
          .update(row)
          .eq("id", payload.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("notification_templates")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useToggleNotificationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("notification_templates")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteNotificationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notification_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
