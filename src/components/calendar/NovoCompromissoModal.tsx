import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AREAS } from "@/lib/metas";
import { useCriarCompromisso, type RecorrenciaCompromisso } from "@/hooks/useCompromissos";

const adicionarMeses = (data: string, meses: number) => {
  const valor = new Date(`${data}T12:00:00`);
  valor.setMonth(valor.getMonth() + meses);
  return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, "0")}-${String(valor.getDate()).padStart(2, "0")}`;
};

export function NovoCompromissoModal({ open, onOpenChange, dataInicial }: { open: boolean; onOpenChange: (v: boolean) => void; dataInicial?: string }) {
  const create = useCriarCompromisso();
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState(dataInicial ?? "");
  const [inicio, setInicio] = useState("15:00");
  const [fim, setFim] = useState("17:00");
  const [area, setArea] = useState("Pessoal");
  const [obs, setObs] = useState("");
  const [recorrencia, setRecorrencia] = useState<RecorrenciaCompromisso>("nenhuma");
  const [recorrenciaFim, setRecorrenciaFim] = useState("");

  useEffect(() => {
    if (open && dataInicial) setData(dataInicial);
  }, [open, dataInicial]);

  const alterarRecorrencia = (valor: RecorrenciaCompromisso) => {
    setRecorrencia(valor);
    if (valor === "nenhuma") setRecorrenciaFim("");
    else if (!recorrenciaFim && data) setRecorrenciaFim(adicionarMeses(data, 3));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;
    if (fim <= inicio) return toast.error("O horário final deve ser depois do inicial.");
    if (recorrencia !== "nenhuma" && !recorrenciaFim) return toast.error("Informe até quando o compromisso deve se repetir.");
    if (recorrenciaFim && recorrenciaFim < data) return toast.error("A data final não pode ser anterior à primeira data.");

    try {
      await create.mutateAsync({
        titulo: titulo.trim(),
        data,
        hora_inicio: inicio,
        hora_fim: fim,
        area,
        observacao: obs.trim() || null,
        recorrencia,
        recorrencia_fim: recorrencia === "nenhuma" ? null : recorrenciaFim,
      });
      toast.success(recorrencia === "nenhuma" ? "Compromisso adicionado" : "Série de compromissos adicionada");
      setTitulo("");
      setObs("");
      setRecorrencia("nenhuma");
      setRecorrenciaFim("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-[520px]"><DialogHeader><DialogTitle>Novo compromisso</DialogTitle><DialogDescription>Reserve um horário e, se precisar, repita-o automaticamente na agenda.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4">
    <div><Label>Título *</Label><Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Mentoria da Josi" required /></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div><Label>Data *</Label><Input type="date" value={data} onChange={e => setData(e.target.value)} required /></div><div><Label>Início *</Label><Input type="time" value={inicio} onChange={e => setInicio(e.target.value)} required /></div><div><Label>Fim *</Label><Input type="time" value={fim} onChange={e => setFim(e.target.value)} required /></div></div>
    <div className={recorrencia === "nenhuma" ? "" : "grid grid-cols-1 gap-3 sm:grid-cols-2"}>
      <div><Label>Recorrência</Label><Select value={recorrencia} onValueChange={v => alterarRecorrencia(v as RecorrenciaCompromisso)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nenhuma">Não se repete</SelectItem><SelectItem value="semanal">Toda semana</SelectItem><SelectItem value="quinzenal">A cada 15 dias</SelectItem><SelectItem value="mensal">Todo mês</SelectItem></SelectContent></Select></div>
      {recorrencia !== "nenhuma" && <div><Label>Repetir até *</Label><Input type="date" value={recorrenciaFim} min={data} onChange={e => setRecorrenciaFim(e.target.value)} required /></div>}
    </div>
    {recorrencia !== "nenhuma" && <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">O compromisso aparecerá automaticamente no mesmo horário, conforme a recorrência escolhida.</p>}
    <div><Label>Área</Label><Select value={area} onValueChange={setArea}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select></div>
    <div><Label>Observação (opcional)</Label><Textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Link, endereço ou preparação necessária…" /></div>
    <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" className="brand-button" disabled={create.isPending}>{create.isPending ? "Salvando…" : recorrencia === "nenhuma" ? "Adicionar compromisso" : "Adicionar série"}</Button></DialogFooter>
  </form></DialogContent></Dialog>;
}
