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
import { FREQUENCIAS, FREQUENCIA_LABEL, type Frequencia } from "@/lib/execucao";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

type LinhaTarefa = {
  descricao: string;
  prazo: string;
  frequencia: Frequencia;
  quantidade: string;
  unidade: string;
  impacto: string;
  esforco: string;
};

const linhaVazia = (): LinhaTarefa => ({
  descricao: "",
  prazo: "",
  frequencia: "unica",
  quantidade: "1",
  unidade: "",
  impacto: "5",
  esforco: "5",
});

export function NovoPlanoModal({ open, onOpenChange }: Props) {
  const { data: metas = [] } = useMetas();
  const create = useCreatePlano();

  const [titulo, setTitulo] = useState("");
  const [metaId, setMetaId] = useState<string>("__none__");
  const [tarefas, setTarefas] = useState<LinhaTarefa[]>([linhaVazia()]);

  const reset = () => {
    setTitulo("");
    setMetaId("__none__");
    setTarefas([linhaVazia()]);
  };

  const patch = (i: number, p: Partial<LinhaTarefa>) =>
    setTarefas((prev) => prev.map((v, j) => (j === i ? { ...v, ...p } : v)));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return toast.error("Informe o título do plano.");

    try {
      await create.mutateAsync({
        titulo: titulo.trim(),
        meta_id: metaId === "__none__" ? null : metaId,
        tarefas: tarefas.map((t) => ({
          descricao: t.descricao,
          prazo: t.prazo || null,
          frequencia: t.frequencia,
          quantidade_planejada: Number(t.quantidade.replace(",", ".")) || 1,
          unidade: t.unidade,
          impacto: Number(t.impacto) || 5,
          esforco: Number(t.esforco) || 5,
        })),
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

          <div className="space-y-3">
            <div>
              <Label>Ações do plano</Label>
              <p className="text-xs text-muted-foreground">
                Defina o que será feito, com que frequência e quanto é o planejado. Ex.:
                "Prospectar" · por dia · 10 · pessoas prospectadas.
              </p>
            </div>
            {tarefas.map((t, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2">
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    value={t.descricao}
                    onChange={(e) => patch(i, { descricao: e.target.value })}
                    placeholder={`Ação ${i + 1}`}
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
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={t.frequencia}
                    onValueChange={(v) => patch(i, { frequencia: v as Frequencia })}
                  >
                    <SelectTrigger className="h-9 w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIAS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {FREQUENCIA_LABEL[f]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    className="w-[80px]"
                    value={t.quantidade}
                    onChange={(e) => patch(i, { quantidade: e.target.value })}
                    aria-label="Quantidade planejada"
                  />
                  <Input
                    className="flex-1 min-w-[150px]"
                    value={t.unidade}
                    onChange={(e) => patch(i, { unidade: e.target.value })}
                    placeholder="pessoas prospectadas, Reels, reuniões…"
                  />
                  <Input
                    type="date"
                    className="w-[150px]"
                    value={t.prazo}
                    onChange={(e) => patch(i, { prazo: e.target.value })}
                  />
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <label className="flex items-center gap-1.5">
                    Impacto
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      className="h-8 w-[64px]"
                      value={t.impacto}
                      onChange={(e) => patch(i, { impacto: e.target.value })}
                    />
                  </label>
                  <label className="flex items-center gap-1.5">
                    Esforço
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      className="h-8 w-[64px]"
                      value={t.esforco}
                      onChange={(e) => patch(i, { esforco: e.target.value })}
                    />
                  </label>
                </div>
              </div>
            ))}
            {tarefas.length < 5 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTarefas((prev) => [...prev, linhaVazia()])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Adicionar ação
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
