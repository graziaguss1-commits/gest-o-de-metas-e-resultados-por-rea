import { useEffect, useState, type FormEvent } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMetas } from "@/hooks/useMetas";
import { useUpdatePlano, type PlanoWithMeta } from "@/hooks/usePlanos";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plano: PlanoWithMeta;
};

export function EditarPlanoModal({ open, onOpenChange, plano }: Props) {
  const { data: metas = [] } = useMetas();
  const update = useUpdatePlano();
  const [titulo, setTitulo] = useState(plano.titulo);
  const [metaId, setMetaId] = useState(plano.meta_id ?? "__none__");

  useEffect(() => {
    if (!open) return;
    setTitulo(plano.titulo);
    setMetaId(plano.meta_id ?? "__none__");
  }, [open, plano.id, plano.titulo, plano.meta_id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!titulo.trim()) return toast.error("Informe o nome do plano.");

    try {
      await update.mutateAsync({
        id: plano.id,
        titulo: titulo.trim(),
        meta_id: metaId === "__none__" ? null : metaId,
      });
      toast.success("Plano atualizado");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar o plano");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Editar plano de ação</DialogTitle>
          <DialogDescription>
            Altere o nome do plano ou a meta estratégica vinculada.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`editar-plano-${plano.id}`}>Nome do plano *</Label>
            <Input
              id={`editar-plano-${plano.id}`}
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Meta vinculada</Label>
            <Select value={metaId} onValueChange={setMetaId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem meta vinculada</SelectItem>
                {metas.map((meta) => meta.id && (
                  <SelectItem key={meta.id} value={meta.id}>
                    {meta.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Salvando…" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
