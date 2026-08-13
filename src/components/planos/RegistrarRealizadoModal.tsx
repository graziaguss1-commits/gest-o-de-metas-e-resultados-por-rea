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
import { Textarea } from "@/components/ui/textarea";
import { useRegistrarExecucao } from "@/hooks/usePlanos";
import { comparativoTempo, formatDuracao } from "@/lib/agenda";
import { todayISO, type Tarefa } from "@/lib/metas";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tarefa: Tarefa | null;
  dataInicial?: string;
};

/**
 * Registro do realizado. Nunca altera o resultado da meta e o tempo real
 * jamais substitui a estimativa da ação — serve apenas para comparação.
 */
export function RegistrarRealizadoModal({ open, onOpenChange, tarefa, dataInicial }: Props) {
  const registrar = useRegistrarExecucao();
  const [quantidade, setQuantidade] = useState("");
  const [data, setData] = useState(dataInicial ?? todayISO());
  const [tempoReal, setTempoReal] = useState("");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (!open) return;
    setQuantidade("");
    setTempoReal("");
    setObservacao("");
    setData(dataInicial ?? todayISO());
  }, [open, dataInicial]);

  const estimado = tarefa?.duracao_minutos ?? null;
  const realNum = Number(tempoReal.replace(",", ".")) || null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tarefa) return;
    const num = Number(quantidade.replace(",", "."));
    if (!Number.isFinite(num)) return toast.error("Informe a quantidade realizada.");
    try {
      await registrar.mutateAsync({
        tarefaId: tarefa.id,
        quantidade: num,
        data,
        observacao,
        tempoRealMinutos: realNum,
      });
      toast.success("Execução registrada — o resultado da meta não muda com este registro.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Registrar realizado</DialogTitle>
          <DialogDescription>
            {tarefa?.descricao}
            {tarefa?.quantidade_planejada
              ? ` — planejado ${tarefa.quantidade_planejada}${tarefa.unidade ? ` ${tarefa.unidade}` : ""}`
              : ""}
            {estimado ? ` · estimado ${formatDuracao(estimado)}` : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rr-qtd">Quantidade realizada</Label>
              <Input
                id="rr-qtd"
                autoFocus
                inputMode="decimal"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder={tarefa?.unidade || "quantidade"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rr-data">Data</Label>
              <Input id="rr-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rr-tempo">Tempo real gasto (min) — opcional</Label>
            <Input
              id="rr-tempo"
              type="number"
              min={0}
              value={tempoReal}
              onChange={(e) => setTempoReal(e.target.value)}
              placeholder="Ex.: 55"
            />
            {comparativoTempo(estimado, realNum) && (
              <p className="text-[11px] text-muted-foreground">{comparativoTempo(estimado, realNum)}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rr-obs">Observação — opcional</Label>
            <Textarea
              id="rr-obs"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="min-h-20 resize-none"
              placeholder="Evidências, aprendizados, bloqueios…"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={registrar.isPending} className="brand-button">
              {registrar.isPending ? "Salvando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
