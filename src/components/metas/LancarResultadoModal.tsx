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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useLancamentos, useLancarResultado, useMetas } from "@/hooks/useMetas";
import {
  formatDateISOToBR,
  formatProgresso,
  formatValor,
  progressoReal,
  todayISO,
} from "@/lib/metas";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** When provided, the meta select is locked. */
  metaId?: string;
};

export function LancarResultadoModal({ open, onOpenChange, metaId }: Props) {
  const { data: metas = [] } = useMetas();
  const lancar = useLancarResultado();

  const [selectedMeta, setSelectedMeta] = useState<string>("");
  const [valor, setValor] = useState<string>("");
  const [data, setData] = useState<string>(todayISO());
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedMeta(metaId ?? "");
      setValor("");
      setData(todayISO());
      setObservacao("");
    }
  }, [open, metaId]);

  const meta = metas.find((m) => m.id === selectedMeta);
  const { data: lancamentos = [] } = useLancamentos(selectedMeta || undefined);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedMeta) return toast.error("Selecione uma meta.");
    const num = Number(valor.replace(",", "."));
    if (!Number.isFinite(num)) return toast.error("Valor inválido.");
    if (!data) return toast.error("Informe a data do lançamento.");

    try {
      const result = await lancar.mutateAsync({
        meta_id: selectedMeta,
        valor: num,
        data_lancamento: data,
        observacao: observacao.trim() || null,
      });

      const mudouParaVermelho =
        result.statusAnterior !== "vermelho" && result.statusNovo === "vermelho";

      if (mudouParaVermelho) {
        toast.warning("Lançamento salvo — esta meta entrou em risco 🚨", {
          description: "A IA já está analisando o desvio. Alertas podem ter sido disparados.",
        });
      } else {
        toast.success("Lançamento salvo — a IA já está analisando o desvio…");
      }
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar lançamento";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Atualizar resultado</DialogTitle>
          <DialogDescription>
            Registre o resultado real da meta. A execução dos planos de ação é acompanhada
            separadamente e não altera este número.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Meta *</Label>
            {metaId ? (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                {meta?.nome ?? "Carregando…"}
              </div>
            ) : (
              <Select value={selectedMeta} onValueChange={setSelectedMeta}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma meta…" />
                </SelectTrigger>
                <SelectContent>
                  {metas.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome} <span className="text-xs text-muted-foreground">({m.area})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="data">Data *</Label>
              <Input
                id="data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valor">
                Valor realizado *{" "}
                {meta && (
                  <span className="text-xs font-normal text-muted-foreground">
                    (em {meta.unidade})
                  </span>
                )}
              </Label>
              <Input
                id="valor"
                type="text"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="Ex: 87400"
                required
              />
            </div>
          </div>

          {meta && (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Resultado atual: <strong className="text-foreground">{formatProgresso(meta)}</strong>{" "}
              · {Math.round(progressoReal(meta.valor_atual, meta.valor_alvo, meta.is_inverse) * 100)}%
              {meta.is_inverse && (
                <span className="italic"> · meta inversa (menor é melhor)</span>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="obs">Observação / evidência (opcional)</Label>
            <Textarea
              id="obs"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Contexto, evidência da medição, sazonalidade…"
              rows={3}
            />
          </div>

          {meta && lancamentos.length > 0 && (
            <div className="space-y-1.5">
              <Label>Histórico de medições</Label>
              <ul className="rounded-md border divide-y max-h-40 overflow-y-auto text-xs">
                {[...lancamentos].reverse().slice(0, 8).map((l) => (
                  <li key={l.id} className="flex items-start gap-2 px-3 py-1.5">
                    <span className="font-mono text-muted-foreground">
                      {formatDateISOToBR(l.data_lancamento)}
                    </span>
                    <span className="font-medium">{formatValor(l.valor, meta.unidade)}</span>
                    <span className="text-muted-foreground truncate">{l.observacao ?? ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={lancar.isPending}
              style={{ backgroundColor: "var(--color-blue)", color: "white" }}
              className="hover:opacity-90"
            >
              {lancar.isPending ? "Salvando…" : "Salvar lançamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
