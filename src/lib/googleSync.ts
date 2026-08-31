import { supabase } from "@/integrations/supabase/client";

let timer: ReturnType<typeof setTimeout> | null = null;

/** Agrupa alterações de agenda e sincroniza sem bloquear a interface. */
export function agendarSyncGoogle(delayMs = 1500) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void supabase.functions.invoke("google-calendar-sync").catch(() => undefined);
  }, delayMs);
}

/** Sincronização imediata usada antes do planejamento com Claude. */
export async function sincronizarGoogleAgora() {
  try {
    await supabase.functions.invoke("google-calendar-sync");
  } catch {
    // Melhor esforço: o planejamento manual continua disponível.
  }
}
