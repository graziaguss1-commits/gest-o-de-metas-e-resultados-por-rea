import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type NotificationTemplate,
  useUpsertNotificationTemplate,
} from "@/hooks/useNotificationTemplates";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template?: NotificationTemplate | null;
};

const CANAIS = [
  { value: "slack", label: "Slack" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "in_app", label: "No app" },
];

const EVENTOS = [
  { value: "meta_risco", label: "Meta em risco" },
  { value: "meta_criada", label: "Nova meta criada" },
  { value: "plano_criado", label: "Plano de ação adicionado" },
  { value: "resumo_semanal", label: "Resumo semanal" },
  { value: "custom", label: "Personalizado" },
];

export function NotificationTemplateModal({ open, onOpenChange, template }: Props) {
  const upsert = useUpsertNotificationTemplate();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [canal, setCanal] = useState("slack");
  const [evento, setEvento] = useState("custom");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    if (open) {
      setNome(template?.nome ?? "");
      setDescricao(template?.descricao ?? "");
      setCanal(template?.canal ?? "slack");
      setEvento(template?.evento ?? "custom");
      setMensagem(template?.mensagem_template ?? "");
    }
  }, [open, template]);

  const submit = async () => {
    try {
      if (!nome.trim()) throw new Error("Informe o nome.");
      if (!mensagem.trim()) throw new Error("Informe a mensagem.");
      await upsert.mutateAsync({
        id: template?.id,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        canal,
        evento,
        mensagem_template: mensagem,
        is_custom: template?.is_custom ?? true,
        ativo: template?.ativo ?? false,
      });
      toast.success(template ? "Modelo atualizado" : "Modelo criado");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{template ? "Editar modelo" : "Novo modelo de notificação"}</DialogTitle>
          <DialogDescription>
            Use variáveis entre chaves como <code>{"{meta_nome}"}</code>, <code>{"{responsavel}"}</code>,
            <code>{" {desvio}"}</code> — serão substituídas no envio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Meta em risco" />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Quando esse modelo é usado"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANAIS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Evento</Label>
              <Select value={evento} onValueChange={setEvento}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENTOS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Mensagem</Label>
            <Textarea
              rows={4}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder=":rotating_light: Meta {meta_nome} entrou em risco. Desvio: {desvio}%."
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={upsert.isPending}
            style={{ backgroundColor: "var(--color-blue)", color: "white" }}
            className="hover:opacity-90"
          >
            {upsert.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Salvando…
              </>
            ) : (
              "Salvar modelo"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
