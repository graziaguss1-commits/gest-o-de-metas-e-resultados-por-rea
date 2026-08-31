import { supabase } from "@/integrations/supabase/client";

let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Agenda uma sincronização com o Google Agenda após alterações locais.
 * Debounce curto para agrupar várias mutações seguidas; falhas são silenciosas
 * (a integração pode nem estar conectada) e nunca bloqueiam o fluxo do app.
 */
export function agendarSyncGoogle(delayMs = 1500) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void supabase.functions
      .invoke("google-calendar-sync")
      .catch(() => undefined);
  }, delayMs);
}

/** Sincronização imediata (usada antes de gerar o plano com o Claude). */
export async function sincronizarGoogleAgora() {
  try {
    await supabase.functions.invoke("google-calendar-sync");
  } catch {
    // Melhor esforço.
  }
}
