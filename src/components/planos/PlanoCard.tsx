import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  useToggleTarefa,
  type PlanoWithMeta,
} from "@/hooks/usePlanos";
import { useAuth } from "@/hooks/useAuth";

export function PlanoCard({ plano }: { plano: PlanoWithMeta }) {
  const toggleTarefa = useToggleTarefa();
  const addTarefa = useAddTarefa();
  const deletePlano = useDeletePlano();
  const { isAdmin } = useAuth();
  const [adding, setAdding] = useState(false);
  const [novaTarefa, setNovaTarefa] = useState("");
  const [novoPrazo, setNovoPrazo] = useState("");

  const total = plano.tarefas.length;
  const done = plano.tarefas.filter((t) => t.concluida).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const submitNova = async (e: FormEvent) => {
    e.preventDefault();
    const txt = novaTarefa.trim();
    if (!txt) return;
    try {
      await addTarefa.mutateAsync({
        planoId: plano.id,
        descricao: txt,
        ordem: total,
        prazo: novoPrazo || null,
      });
      setNovaTarefa("");
      setNovoPrazo("");
      setAdding(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao adicionar tarefa";
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
            {done}/{total} tarefas concluídas · criado em{" "}
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
                  Todas as tarefas vinculadas serão removidas. Esta ação não pode ser desfeita.
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

      {/* progress */}
      <div className="space-y-1">
        <div
          className="w-full h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: "hsl(var(--secondary))" }}
        >
          <div
            className="h-full transition-all"
            style={{
              width: `${pct}%`,
              backgroundColor: pct === 100 ? "var(--color-green)" : "var(--color-blue)",
            }}
          />
        </div>
        <div className="text-[10px] text-muted-foreground text-right">{pct}%</div>
      </div>

      {/* tarefas */}
      {total === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          Nenhuma tarefa ainda. Adicione abaixo.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {plano.tarefas.map((t) => (
            <li
              key={t.id}
              className="flex items-start gap-2 py-1 group"
            >
              <Checkbox
                checked={t.concluida}
                onCheckedChange={(v) =>
                  toggleTarefa.mutate({ id: t.id, concluida: v === true })
                }
                className="mt-0.5"
              />
              <span
                className={`text-sm flex-1 leading-snug whitespace-pre-line ${t.concluida ? "line-through text-muted-foreground" : ""}`}
              >
                {t.descricao}
              </span>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap mt-0.5 tabular-nums">
                {t.prazo
                  ? new Date(`${t.prazo}T00:00:00`).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    })
                  : "—"}
              </span>
            </li>
          ))}

        </ul>
      )}

      {/* nova tarefa */}
      {adding ? (
        <form onSubmit={submitNova} className="flex gap-2 pt-1">
          <Input
            autoFocus
            value={novaTarefa}
            onChange={(e) => setNovaTarefa(e.target.value)}
            placeholder="Descrição da tarefa"
            className="h-8 flex-1"
          />
          <Input
            type="date"
            value={novoPrazo}
            onChange={(e) => setNovoPrazo(e.target.value)}
            className="h-8 w-[140px]"
          />
          <Button type="submit" size="sm" disabled={!novaTarefa.trim()}>
            Adicionar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setNovaTarefa("");
              setNovoPrazo("");
              setAdding(false);
            }}
          >
            Cancelar
          </Button>
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
          Adicionar tarefa
        </Button>
      )}
    </div>
  );
}
