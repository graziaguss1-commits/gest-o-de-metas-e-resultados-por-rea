import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { downloadGSheetsTemplate } from "@/lib/gsheetsTemplate";
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
  useDisconnectGoogleSheets,
  useSaveGoogleSheets,
} from "@/hooks/useAppSettings";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

export function GoogleSheetsModal({ open, onOpenChange }: Props) {
  const { data: settings } = useAppSettings();
  const save = useSaveGoogleSheets();
  const disconnect = useDisconnectGoogleSheets();
  const [url, setUrl] = useState("");

  const submit = async () => {
    try {
      await save.mutateAsync(url);
      toast.success("Google Sheets conectado");
      setUrl("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync();
      toast.success("Google Sheets desconectado");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Conectar Google Sheets</DialogTitle>
          <DialogDescription>
            Cole a URL da planilha que será usada como fonte de dados. Garanta que ela esteja
            compartilhada com permissão de leitura para o e-mail de serviço da sua workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="gsheets-url">URL da planilha</Label>
            <Input
              id="gsheets-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={
                settings?.gsheets_url
                  ? settings.gsheets_url
                  : "https://docs.google.com/spreadsheets/d/…"
              }
            />
            <p className="text-xs text-muted-foreground">
              A URL fica salva nas configurações. Os mapeamentos de coluna por meta serão
              definidos na próxima fase.
            </p>
          </div>

          <div
            className="rounded-md border p-3 flex items-start gap-3"
            style={{ backgroundColor: "var(--color-blue-soft)" }}
          >
            <Download className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--color-blue)" }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">Não sabe o formato esperado?</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Baixe o modelo .xlsx com as abas <strong>Metas</strong>, <strong>Resultados</strong> e{" "}
                <strong>Instruções</strong>. Preencha, suba no Drive e cole a URL acima.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 h-7 text-xs"
                onClick={() => {
                  try {
                    downloadGSheetsTemplate();
                    toast.success("Modelo baixado");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Erro ao gerar modelo");
                  }
                }}
              >
                <Download className="h-3 w-3 mr-1.5" />
                Baixar modelo (.xlsx)
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {settings?.gsheets_configured ? (
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
              disabled={!url.trim() || save.isPending}
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
