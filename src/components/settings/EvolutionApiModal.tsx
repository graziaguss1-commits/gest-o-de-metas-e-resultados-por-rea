import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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
import {
  useAppSettings,
  useDisconnectEvolutionApi,
  useSaveEvolutionApi,
} from "@/hooks/useAppSettings";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

export function EvolutionApiModal({ open, onOpenChange }: Props) {
  const { data: settings } = useAppSettings();
  const save = useSaveEvolutionApi();
  const disconnect = useDisconnectEvolutionApi();
  const [baseUrl, setBaseUrl] = useState(settings?.evolution_base_url ?? "");
  const [instance, setInstance] = useState(settings?.evolution_instance ?? "");
  const [apiKey, setApiKey] = useState("");
  const [show, setShow] = useState(false);

  const submit = async () => {
    try {
      await save.mutateAsync({ baseUrl, instance, apiKey });
      toast.success("Evolution API conectada");
      setApiKey("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync();
      toast.success("Evolution API desconectada");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>WhatsApp · Evolution API</DialogTitle>
          <DialogDescription>
            Conecte sua instância da Evolution API para disparar alertas via WhatsApp. A API key
            fica criptografada no Vault — nunca aparece nas requisições do navegador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="evo-url">URL base</Label>
            <Input
              id="evo-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://evolution.suaempresa.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evo-instance">Instância</Label>
            <Input
              id="evo-instance"
              value={instance}
              onChange={(e) => setInstance(e.target.value)}
              placeholder="metasia"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evo-key">API Key</Label>
            <div className="relative">
              <Input
                id="evo-key"
                type={show ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  settings?.evolution_configured
                    ? "•••••••••• (cole nova chave para substituir)"
                    : "Sua API key da Evolution"
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
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {settings?.evolution_configured ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleDisconnect}
              disabled={disconnect.isPending}
            >
              {disconnect.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Desconectar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={save.isPending}
              style={{ backgroundColor: "var(--color-blue)", color: "white" }}
              className="hover:opacity-90"
            >
              {save.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Salvando…
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
