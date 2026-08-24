import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CheckCircle2, ExternalLink, Eye, EyeOff, KeyRound, Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctions";

interface RegistryRow {
  service_name: string;
  label: string | null;
  is_active: boolean | null;
  updated_at: string | null;
}

type ConnectionStatus = "valid" | "invalid" | "unconfigured" | "checking";

const SERVICE_NAME = "anthropic";
const SERVICE_LABEL = "Claude (Anthropic)";

export default function ApiKeysSettings() {
  const [services, setServices] = useState<RegistryRow[]>([]);
  const [status, setStatus] = useState<Record<string, ConnectionStatus>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("api_keys_registry")
      .select("service_name, label, is_active, updated_at")
      .eq("service_name", SERVICE_NAME)
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error("Não foi possível carregar a integração com o Claude");
      return;
    }
    setServices(data ?? []);
  };

  useEffect(() => { void load(); }, []);

  const openForm = (isEditing: boolean) => {
    setEditing(isEditing);
    setApiKey("");
    setShowKey(false);
    setOpen(true);
  };

  const save = async () => {
    if (!apiKey.trim()) {
      toast.error("Informe a chave da Anthropic");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("store-api-key", {
        body: {
          service_name: SERVICE_NAME,
          api_key: apiKey.trim(),
          label: SERVICE_LABEL,
        },
      });

      if (error || !data?.success) {
        const message = await getEdgeFunctionErrorMessage(
          error,
          data,
          "Não foi possível salvar a chave da Anthropic.",
        );
        toast.error(message);
        return;
      }

      setApiKey("");
      setStatus((previous) => ({ ...previous, [SERVICE_NAME]: "valid" }));
      setOpen(false);
      await load();
      toast.success("Claude conectado e validado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a chave da Anthropic.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-api-key", {
        body: { service_name: SERVICE_NAME },
      });

      if (error || !data?.success) {
        const message = await getEdgeFunctionErrorMessage(
          error,
          data,
          "Não foi possível remover a chave da Anthropic.",
        );
        toast.error(message);
        return;
      }

      setStatus((previous) => ({ ...previous, [SERVICE_NAME]: "unconfigured" }));
      setConfirmDel(false);
      await load();
      toast.success("Chave removida do Vault");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover a chave da Anthropic.");
    } finally {
      setRemoving(false);
    }
  };

  const test = async () => {
    setStatus((previous) => ({ ...previous, [SERVICE_NAME]: "checking" }));
    try {
      const { data, error } = await supabase.functions.invoke("validate-api-key", {
        body: { service_name: SERVICE_NAME },
      });

      if (error) {
        const message = await getEdgeFunctionErrorMessage(
          error,
          data,
          "Não foi possível testar a conexão com a Anthropic.",
        );
        setStatus((previous) => ({ ...previous, [SERVICE_NAME]: "invalid" }));
        toast.error(message);
        return;
      }

      const nextStatus = (data?.status as ConnectionStatus | undefined) ?? "invalid";
      setStatus((previous) => ({ ...previous, [SERVICE_NAME]: nextStatus }));
      if (nextStatus === "valid") toast.success("Conexão com o Claude funcionando");
      else toast.error(data?.error ?? "A chave da Anthropic não é válida");
      await load();
    } catch (error) {
      setStatus((previous) => ({ ...previous, [SERVICE_NAME]: "invalid" }));
      toast.error(error instanceof Error ? error.message : "Não foi possível testar a conexão com a Anthropic.");
    }
  };

  const configured = services[0] ?? null;
  const effectiveStatus = status[SERVICE_NAME]
    ?? (configured?.is_active ? "valid" : configured ? "invalid" : "unconfigured");

  return (
    <div className="space-y-4 max-w-2xl">
      {!configured ? (
        <Card>
          <CardContent className="py-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div
              className="h-11 w-11 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: "var(--color-blue-soft)", color: "var(--color-blue)" }}
            >
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold">Conectar Claude</h4>
              <p className="text-sm text-muted-foreground mt-0.5">
                Use sua chave da Anthropic para gerar diagnósticos e ações nas metas.
              </p>
            </div>
            <Button onClick={() => openForm(false)}>
              <Plus className="h-4 w-4 mr-1.5" /> Conectar
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-start justify-between gap-3">
              <span className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" style={{ color: "var(--color-blue)" }} />
                {configured.label ?? SERVICE_LABEL}
              </span>
              {effectiveStatus === "checking" ? (
                <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Testando</Badge>
              ) : effectiveStatus === "valid" ? (
                <Badge className="bg-success text-success-foreground">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
                </Badge>
              ) : (
                <Badge variant="destructive">Conexão inválida</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Usada em: Análise de Saúde das metas · modelo Claude Sonnet 5
              {configured.updated_at && (
                <> · atualizada em {new Date(configured.updated_at).toLocaleDateString("pt-BR")}</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => openForm(true)}>Alterar chave</Button>
            <Button
              size="sm"
              variant="outline"
              onClick={test}
              disabled={effectiveStatus === "checking"}
            >
              {effectiveStatus === "checking" ? "Testando…" : "Testar conexão"}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setConfirmDel(true)}>Remover</Button>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <KeyRound className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        A chave fica criptografada no Vault. Ao gerar uma análise, os dados daquela meta são enviados à API da Anthropic.
      </p>

      <Dialog open={open} onOpenChange={(nextOpen) => !saving && setOpen(nextOpen)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Alterar chave da Anthropic" : "Conectar Claude"}</DialogTitle>
            <DialogDescription>
              A conexão será testada antes de a chave ser armazenada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Serviço</Label>
              <Input value={SERVICE_LABEL} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="anthropic-api-key">Chave de API da Anthropic</Label>
              <div className="relative">
                <Input
                  id="anthropic-api-key"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  className="pr-10"
                  placeholder="sk-ant-…"
                  autoComplete="off"
                  disabled={saving}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((visible) => !visible)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={showKey ? "Ocultar chave" : "Mostrar chave"}
                  disabled={saving}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Abrir chaves da Anthropic
            </a>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !apiKey.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {saving ? "Validando…" : "Validar e salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDel} onOpenChange={(nextOpen) => !removing && setConfirmDel(nextOpen)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover a conexão com o Claude?</AlertDialogTitle>
            <AlertDialogDescription>
              A chave será apagada do Vault e novas análises ficarão indisponíveis até outra chave ser conectada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={removing}>
              {removing ? "Removendo…" : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
