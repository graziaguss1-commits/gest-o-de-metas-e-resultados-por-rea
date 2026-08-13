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
import { DuracaoPicker } from "@/components/planos/DuracaoPicker";
import { DiasSemanaPicker } from "@/components/planos/DiasSemanaPicker";
import { ImpactoEsforcoPicker } from "@/components/actions/ImpactoEsforcoPicker";
import { formatDuracao, horaFim, labelDiasSemana } from "@/lib/agenda";

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
  impacto: number;
  esforco: number;
  duracao: number | null;
  horario: string;
  dias: number[] | null;
};

const linhaVazia = (): LinhaTarefa => ({
  descricao: "",
  prazo: "",
  frequencia: "unica",
  quantidade: "1",
  unidade: "",
  impacto: 5,
  esforco: 5,
  duracao: null,
  horario: "",
  dias: null,
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
    const diariaIncompleta = tarefas.find((t) => t.descricao.trim() && t.frequencia === "diaria" && (!t.horario || !t.duracao || !t.dias?.length));
    if (diariaIncompleta) return toast.error(`Complete horário, duração e dias da rotina diária: ${diariaIncompleta.descricao}`);

    try {
      await create.mutateAsync({
        titulo: titulo.trim(),
        meta_id: metaId === "__none__" ? null : metaId,
        tarefas: tarefas.map((t) => ({
          descricao: t.descricao,
          prazo: t.frequencia === "unica" ? (t.prazo || null) : null,
          data_inicio: t.frequencia !== "unica" ? new Date().toISOString().slice(0, 10) : null,
          data_fim: t.frequencia !== "unica" ? (t.prazo || null) : null,
          frequencia: t.frequencia,
          quantidade_planejada: Number(t.quantidade.replace(",", ".")) || 1,
          unidade: t.unidade,
          impacto: t.impacto,
          esforco: t.esforco,
          duracao_minutos: t.duracao,
          horario_preferencial: t.horario || null,
          dias_semana: t.frequencia === "diaria" ? t.dias : null,
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
                    onValueChange={(v) => patch(i, { frequencia: v as Frequencia, dias: v === "diaria" ? (t.dias ?? [1,2,3,4,5]) : t.dias })}
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
                  <label className="min-w-[150px] flex-1 text-[10px] font-semibold text-muted-foreground">
                    {t.frequencia === "unica" ? "Prazo" : "Rotina ativa até (opcional)"}
                    <Input
                      type="date"
                      className="mt-1 w-full"
                      value={t.prazo}
                      onChange={(e) => patch(i, { prazo: e.target.value })}
                    />
                  </label>
                </div>
                <div className="space-y-2 rounded-md bg-muted/40 p-2.5">
                  <div className="text-[11px] font-semibold">
                    Duração estimada por execução{t.frequencia === "diaria" ? " *" : ""}
                    <span className="ml-1 font-normal text-muted-foreground">
                      (quanto tempo leva cada vez — não é o prazo final)
                    </span>
                  </div>
                  <DuracaoPicker value={t.duracao} onChange={(v) => patch(i, { duracao: v })} />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      Horário da rotina{t.frequencia === "diaria" ? " *" : ""}
                      <Input
                        type="time"
                        className="h-8 w-[110px]"
                        value={t.horario}
                        onChange={(e) => patch(i, { horario: e.target.value })}
                      />
                    </label>
                    {t.horario && t.duracao ? (
                      <span className="text-[11px] font-medium text-[var(--brand-primary)]">
                        {t.horario}–{horaFim(t.horario, t.duracao)}
                      </span>
                    ) : null}
                  </div>
                  {t.frequencia === "diaria" && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold">Dias de execução *</div>
                      <DiasSemanaPicker value={t.dias} onChange={(v) => patch(i, { dias: v })} />
                      {labelDiasSemana(t.dias) && (
                        <p className="text-[11px] text-muted-foreground">{labelDiasSemana(t.dias)}</p>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {t.frequencia === "diaria" && (!t.horario || !t.duracao || !t.dias?.length) && <span className="mb-1 block font-semibold text-destructive">Defina horário, duração e dias para inserir a rotina automaticamente na agenda.</span>}
                    Resumo: {t.quantidade || 0} {t.unidade || "unidades"} ·{" "}
                    {FREQUENCIA_LABEL[t.frequencia].toLowerCase()}
                    {t.duracao ? ` · ${formatDuracao(t.duracao)} por execução` : " · sem duração estimada"}
                    {t.prazo ? ` · prazo final ${t.prazo.split("-").reverse().join("/")}` : ""}
                  </p>
                </div>
                <ImpactoEsforcoPicker
                  impacto={t.impacto}
                  esforco={t.esforco}
                  onImpactoChange={(impacto) => patch(i, { impacto })}
                  onEsforcoChange={(esforco) => patch(i, { esforco })}
                  compact
                />
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
