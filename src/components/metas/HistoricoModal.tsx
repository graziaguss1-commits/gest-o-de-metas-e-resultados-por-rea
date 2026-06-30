import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLancamentos } from "@/hooks/useMetas";
import { formatDateISOToBR, formatValor, type MetaWithResponsavel } from "@/lib/metas";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  meta: MetaWithResponsavel | null;
};

export function HistoricoModal({ open, onOpenChange, meta }: Props) {
  const { data: lancamentos = [], isLoading } = useLancamentos(meta?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de lançamentos</DialogTitle>
          <DialogDescription>{meta?.nome ?? ""}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Carregando histórico…
          </div>
        ) : lancamentos.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Nenhum lançamento ainda. Use "Lançar resultado" para registrar o primeiro.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Data</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...lancamentos].reverse().map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">
                    {formatDateISOToBR(l.data_lancamento)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {meta ? formatValor(l.valor, meta.unidade) : l.valor}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {l.observacao ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
