import { useEffect, useState } from "react";
import { Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFunil, useSalvarEtapas, useToggleFunil } from "@/hooks/useFunil";
import { useLancarResultado } from "@/hooks/useMetas";
import { gargaloFunil, taxasFunil } from "@/lib/execucao";
import { todayISO, type MetaWithResponsavel } from "@/lib/metas";

type Linha = { id?: string; nome: string; ordem: number; valor: number };

/** Seção compacta de funil de conversão dentro da meta (opcional). */
export function FunilMeta({ meta }: { meta: MetaWithResponsavel }) {
  const ativo = !!meta.funil_ativo;
  const { data: etapas = [] } = useFunil(ativo ? meta.id ?? undefined : undefined);
  const toggle = useToggleFunil();
  const salvar = useSalvarEtapas(meta.id ?? undefined);
  const lancar = useLancarResultado();

  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    setLinhas(etapas.map((e) => ({ id: e.id, nome: e.nome, ordem: e.ordem, valor: e.valor })));
  }, [etapas]);

  const taxas = taxasFunil(linhas.map((l, i) => ({ id: l.id ?? String(i), ...l })));
  const gargalo = gargaloFunil(linhas.map((l, i) => ({ id: l.id ?? String(i), ...l })));
  const ultima = linhas[linhas.length - 1];

  return (
    <div className="metasia-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sm">Funil de conversão</h3>
          <p className="text-xs text-muted-foreground">
            Opcional. Use em metas comerciais para ver onde está o gargalo.
          </p>
        </div>
        <Switch
          checked={ativo}
          onCheckedChange={(v) =>
            meta.id &&
            toggle.mutate(
              { metaId: meta.id, ativo: v },
              { onError: (e) => toast.error(e instanceof Error ? e.message : "Erro") },
            )
          }
        />
      </div>

      {ativo && (
        <>
          <div className="space-y-2">
            {linhas.map((l, i) => (
              <div key={l.id ?? `nova-${i}`} className="space-y-1">
                <div className="flex gap-2 items-center">
                  <Input
                    value={l.nome}
                    onChange={(e) =>
                      setLinhas((prev) =>
                        prev.map((v, j) => (j === i ? { ...v, nome: e.target.value } : v)),
                      )
                    }
                    className="h-8 flex-1"
                    placeholder="Etapa"
                  />
                  <Input
                    type="number"
                    min={0}
                    value={String(l.valor)}
                    onChange={(e) =>
                      setLinhas((prev) =>
                        prev.map((v, j) =>
                          j === i ? { ...v, valor: Number(e.target.value) || 0 } : v,
                        ),
                      )
                    }
                    className="h-8 w-24"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setLinhas((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {i > 0 && (
                  <div
                    className="text-[11px] pl-1"
                    style={{
                      color:
                        gargalo && gargalo.para === l.nome
                          ? "var(--color-red)"
                          : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {Math.round((taxas[i - 1]?.taxa ?? 0) * 100)}% vindos de {linhas[i - 1].nome}
                    {gargalo && gargalo.para === l.nome ? " · maior gargalo" : ""}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setLinhas((prev) => [...prev, { nome: "Nova etapa", ordem: prev.length, valor: 0 }])
              }
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Etapa
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={salvar.isPending}
              onClick={async () => {
                try {
                  await salvar.mutateAsync(linhas.map((l, ordem) => ({ ...l, ordem })));
                  toast.success("Funil atualizado");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Erro ao salvar funil");
                }
              }}
              style={{ backgroundColor: "var(--color-blue)", color: "white" }}
              className="hover:opacity-90"
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              Salvar funil
            </Button>
            {ultima && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmar(true)}
              >
                Usar "{ultima.nome}" como resultado
              </Button>
            )}
          </div>

          <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Atualizar o resultado da meta?</AlertDialogTitle>
                <AlertDialogDescription>
                  O resultado atual passará a ser {ultima?.valor ?? 0} ({ultima?.nome}). Esta
                  alteração só acontece com a sua confirmação.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    if (!meta.id || !ultima) return;
                    try {
                      await lancar.mutateAsync({
                        meta_id: meta.id,
                        valor: ultima.valor,
                        data_lancamento: todayISO(),
                        observacao: `Resultado confirmado a partir da etapa "${ultima.nome}" do funil`,
                      });
                      toast.success("Resultado atualizado a partir do funil");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Erro ao atualizar");
                    }
                  }}
                >
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
