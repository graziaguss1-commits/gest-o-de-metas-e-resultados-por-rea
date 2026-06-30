import { useState } from "react";
import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppSettings, useSaveSlackWebhook } from "@/hooks/useAppSettings";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function SlackWebhookModal({ open, onOpenChange }: Props) {
  const { data: settings } = useAppSettings();
  const save = useSaveSlackWebhook();
  const [webhook, setWebhook] = useState("");
  const [show, setShow] = useState(false);

  const reset = () => {
    setWebhook("");
    setShow(false);
  };

  const submit = async () => {
    try {
      await save.mutateAsync(webhook);
      toast.success("Webhook salvo no Vault");
      reset();
      onOpenChange(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao salvar";
      toast.error(message);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Webhook do Slack</DialogTitle>
          <DialogDescription>
            Crie um Incoming Webhook em api.slack.com/apps e cole a URL aqui. A chave fica
            criptografada no Supabase Vault — nunca aparece nas requisições do navegador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="webhook-url">
              URL do webhook
              {settings?.slack_webhook_configured && (
                <span
                  className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                  style={{ backgroundColor: "var(--color-green-bg)", color: "var(--color-green)" }}
                >
                  <Check className="h-3 w-3" /> configurado
                </span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="webhook-url"
                type={show ? "text" : "password"}
                value={webhook}
                onChange={(e) => setWebhook(e.target.value)}
                placeholder={
                  settings?.slack_webhook_configured
                    ? "•••••••••• (cole nova URL para substituir)"
                    : "https://hooks.slack.com/services/..."
                }
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Os gatilhos (quando disparar, threshold, resumo semanal) ficam na aba
              Notificações.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={!webhook.trim() || save.isPending}
            style={{ backgroundColor: "var(--color-blue)", color: "white" }}
            className="hover:opacity-90"
          >
            {save.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Salvando…
              </>
            ) : (
              "Salvar webhook"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
