import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatusChip } from "@/components/metas/StatusChip";
import {
  useAddTarefa,
  useDeletePlano,
  useExecucoes,
  useRegistrarExecucao,
  useToggleTarefa,
  type PlanoWithMeta,
} from "@/hooks/usePlanos";
import { useAuth } from "@/hooks/useAuth";
import {
  execucaoPlano,
  execucaoTarefa,
  FREQUENCIAS,
  FREQUENCIA_LABEL,
  getFrequencia,
  type Execucao,
  type Frequencia,
} from "@/lib/execucao";
import { todayISO, type Tarefa } from "@/lib/metas";

export function PlanoCard({ plano }: { plano: PlanoWithMeta }) {
  const toggleTarefa = useToggleTarefa();
  const addTarefa = useAddTarefa();
  const deletePlano = useDeletePlano();
  const { data: execucoes = [] } = useExecucoes();
  const { isAdmin } = useAuth();
  const [adding, setAdding] = useState(false);
  const [nova, setNova] = useState({
    descricao: "",
    prazo: "",
    frequencia: "unica" as Frequencia,
    quantidade: "1",
    unidade: "",
  });

  const total = plano.tarefas.length;
  const done = plano.tarefas.filter((t) => t.concluida).length;
  // Execução = média ponderada pelo impacto das ações (ver src/lib/execucao.ts)
  const pct = Math.round(execucaoPlano(plano.tarefas, execucoes) * 100);

  const submitNova = async (e: FormEvent) => {
    e.preventDefault();
    const txt = nova.descricao.trim();
    if (!txt) return;
    try {
      await addTarefa.mutateAsync({
        planoId: plano.id,
        descricao: txt,
        ordem: total,
        prazo: nova.prazo || null,
        frequencia: nova.frequencia,
        quantidade_planejada: Number(nova.quantidade.replace(",", ".")) || 1,
        unidade: nova.unidade,
      });
      setNova({ descricao: "", prazo: "", frequencia: "unica", quantidade: "1", unidade: "" });
      setAdding(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao adicionar ação";
      toast.error(message);
    }
  };

  return (
    <div className="metasia-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-base truncate">{plano.titulo}</h3>
            {plano.meta && (
              <Link
                to={`/metas/${plano.meta.id}/analise`}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 hover:opacity-80"
                style={{ backgroundColor: "var(--color-blue-soft)", color: "var(--color-blue)" }}
              >
                {plano.meta.nome}
                <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            )}
            {plano.meta && <StatusChip status={plano.meta.status} size="sm" />}
          </div>
          <div className="text-xs text-muted-foreground">
            Execução do plano: {pct}% · {done}/{total} marcadas · criado em{" "}
            {new Date(plano.created_at).toLocaleDateString("pt-BR")}
          </div>
        </div>

        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir plano "{plano.titulo}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todas as ações vinculadas e seus registros de execução serão removidos. Esta
                  ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    try {
                      await deletePlano.mutateAsync(plano.id);
                      toast.success("Plano excluído");
                    } catch (e) {
                      const message = e instanceof Error ? e.message : "Erro ao excluir";
                      toast.error(message);
                    }
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* execução do plano */}
      <div className="space-y-1">
        <div
          className="w-full h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: "hsl(var(--secondary))" }}
        >
          <div
            className="h-full transition-all"
            style={{
              width: `${pct}%`,
              backgroundColor: pct === 100 ? "var(--color-green)" : "var(--color-amber)",
            }}
          />
        </div>
        <div className="text-[10px] text-muted-foreground text-right">
          Execução (não altera o resultado da meta) · {pct}%
        </div>
      </div>

      {/* ações */}
      {total === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          Nenhuma ação ainda. Adicione abaixo.
        </p>
      ) : (
        <ul className="space-y-2">
          {plano.tarefas.map((t) => (
            <TarefaLinha
              key={t.id}
              tarefa={t}
              execucoes={execucoes}
              onToggle={(v) => toggleTarefa.mutate({ id: t.id, concluida: v })}
            />
          ))}
        </ul>
      )}

      {/* nova ação */}
      {adding ? (
        <form onSubmit={submitNova} className="space-y-2 pt-1">
          <Input
            autoFocus
            value={nova.descricao}
            onChange={(e) => setNova({ ...nova, descricao: e.target.value })}
            placeholder="Ex: Prospectar pessoas"
            className="h-8"
          />
          <div className="flex flex-wrap gap-2">
            <Select
              value={nova.frequencia}
              onValueChange={(v) => setNova({ ...nova, frequencia: v as Frequencia })}
            >
              <SelectTrigger className="h-8 w-[130px]">
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
              value={nova.quantidade}
              onChange={(e) => setNova({ ...nova, quantidade: e.target.value })}
              className="h-8 w-[80px]"
              aria-label="Quantidade planejada"
            />
            <Input
              value={nova.unidade}
              onChange={(e) => setNova({ ...nova, unidade: e.target.value })}
              placeholder="pessoas prospectadas"
              className="h-8 flex-1 min-w-[140px]"
            />
            <Input
              type="date"
              value={nova.prazo}
              onChange={(e) => setNova({ ...nova, prazo: e.target.value })}
              className="h-8 w-[140px]"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!nova.descricao.trim()}>
              Adicionar
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Adicionar ação
        </Button>
      )}
    </div>
  );
}

function TarefaLinha({
  tarefa,
  execucoes,
  onToggle,
}: {
  tarefa: Tarefa;
  execucoes: Execucao[];
  onToggle: (v: boolean) => void;
}) {
  const registrar = useRegistrarExecucao();
  const [valor, setValor] = useState("");
  const freq = getFrequencia(tarefa);
  const exec = execucaoTarefa(tarefa, execucoes);
  const mensuravel = freq !== "unica" || Number(tarefa.quantidade_planejada ?? 1) > 1 || !!tarefa.unidade;

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    const num = Number(valor.replace(",", "."));
    if (!Number.isFinite(num)) return toast.error("Informe um número.");
    try {
      await registrar.mutateAsync({
        tarefaId: tarefa.id,
        quantidade: num,
        data: todayISO(),
      });
      setValor("");
      toast.success("Execução registrada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar");
    }
  };

  return (
    <li className="rounded-lg border bg-card/60 px-3 py-2 space-y-1.5">
      <div className="flex items-start gap-2">
        <Checkbox
          checked={tarefa.concluida}
          onCheckedChange={(v) => onToggle(v === true)}
          className="mt-0.5"
        />
        <span
          className={`text-sm flex-1 leading-snug ${tarefa.concluida ? "line-through text-muted-foreground" : ""}`}
        >
          {tarefa.descricao}
        </span>
        <span className="text-[11px] text-muted-foreground whitespace-nowrap tabular-nums">
          {FREQUENCIA_LABEL[freq]}
          {tarefa.prazo
            ? ` · ${new Date(`${tarefa.prazo}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`
            : ""}
        </span>
      </div>

      {mensuravel && (
        <div className="flex items-center gap-2 pl-6 flex-wrap">
          <span className="text-xs font-medium" style={{ color: "var(--color-amber)" }}>
            {exec.texto}
          </span>
          <span className="text-[10px] text-muted-foreground">({exec.periodoLabel})</span>
          <form onSubmit={salvar} className="flex items-center gap-1 ml-auto">
            <Input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="realizado"
              inputMode="decimal"
              className="h-7 w-[92px] text-xs"
            />
            <Button type="submit" size="sm" variant="outline" className="h-7 text-xs" disabled={!valor}>
              Registrar
            </Button>
          </form>
        </div>
      )}
    </li>
  );
}
