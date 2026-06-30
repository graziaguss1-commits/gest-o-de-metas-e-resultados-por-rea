import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMetas } from "@/hooks/useMetas";
import { useCreatePlano } from "@/hooks/usePlanos";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function NovoPlanoModal({ open, onOpenChange }: Props) {
  const { data: metas = [] } = useMetas();
  const create = useCreatePlano();

  const [titulo, setTitulo] = useState("");
  const [metaId, setMetaId] = useState<string>("__none__");
  const [tarefas, setTarefas] = useState<{ descricao: string; prazo: string }[]>([
    { descricao: "", prazo: "" },
  ]);

  const reset = () => {
    setTitulo("");
    setMetaId("__none__");
    setTarefas([{ descricao: "", prazo: "" }]);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return toast.error("Informe o título do plano.");

    try {
      await create.mutateAsync({
        titulo: titulo.trim(),
        meta_id: metaId === "__none__" ? null : metaId,
        tarefas: tarefas.map((t) => ({ descricao: t.descricao, prazo: t.prazo || null })),
      });
      toast.success("Plano criado");
      reset();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao criar plano";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo plano de ação</DialogTitle>
          <DialogDescription>
            Vincule a uma meta (opcional) e adicione até 5 tarefas iniciais. Tarefas vazias serão descartadas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Sprint de retenção Q2"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Meta vinculada</Label>
            <Select value={metaId} onValueChange={setMetaId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem meta vinculada" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem meta vinculada</SelectItem>
                {metas.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tarefas iniciais</Label>
            {tarefas.map((t, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  className="flex-1"
                  value={t.descricao}
                  onChange={(e) =>
                    setTarefas((prev) =>
                      prev.map((v, j) => (j === i ? { ...v, descricao: e.target.value } : v)),
                    )
                  }
                  placeholder={`Tarefa ${i + 1}`}
                />
                <Input
                  type="date"
                  className="w-[150px]"
                  value={t.prazo}
                  onChange={(e) =>
                    setTarefas((prev) =>
                      prev.map((v, j) => (j === i ? { ...v, prazo: e.target.value } : v)),
                    )
                  }
                />
                {tarefas.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setTarefas((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {tarefas.length < 5 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTarefas((prev) => [...prev, { descricao: "", prazo: "" }])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Adicionar tarefa
              </Button>
            )}
          </div>


          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={create.isPending}
              style={{ backgroundColor: "var(--color-blue)", color: "white" }}
              className="hover:opacity-90"
            >
              {create.isPending ? "Criando…" : "Criar plano"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
