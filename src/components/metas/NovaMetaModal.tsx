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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AREAS,
  METRIC_CONFIG,
  METRIC_TYPES,
  PERIODICIDADES,
  getMetricType,
  todayISO,
  type MetaWithResponsavel,
  type MetricType,
} from "@/lib/metas";
import { useCreateMeta, useMembros, useUpdateMeta } from "@/hooks/useMetas";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Quando informada, o modal edita a meta em vez de criar uma nova. */
  meta?: MetaWithResponsavel | null;
};

export function NovaMetaModal({ open, onOpenChange, meta }: Props) {
  const isEdit = !!meta;

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [area, setArea] = useState<string>(AREAS[0]);
  const [responsavelId, setResponsavelId] = useState<string>("__none__");
  const [metricType, setMetricType] = useState<MetricType>("quantidade");
  const [valorAlvo, setValorAlvo] = useState<string>("");
  const [unidade, setUnidade] = useState("");
  const [periodicidade, setPeriodicidade] = useState<string>("mensal");
  const [dataInicio, setDataInicio] = useState<string>(todayISO());
  const [dataFim, setDataFim] = useState<string>("");
  const [isInverse, setIsInverse] = useState(false);

  const { data: membros = [] } = useMembros();
  const createMeta = useCreateMeta();
  const updateMeta = useUpdateMeta();
  const saving = createMeta.isPending || updateMeta.isPending;

  const cfg = METRIC_CONFIG[metricType];

  useEffect(() => {
    if (!open) return;
    if (meta) {
      const tipo = getMetricType(meta);
      setNome(meta.nome ?? "");
      setDescricao(meta.descricao ?? "");
      setArea(meta.area ?? AREAS[0]);
      setResponsavelId(meta.responsavel_id ?? "__none__");
      setMetricType(tipo);
      setValorAlvo(String(meta.valor_alvo ?? ""));
      setUnidade(METRIC_CONFIG[tipo].unidadeFixa ?? meta.unidade ?? "");
      setPeriodicidade(meta.periodicidade ?? "mensal");
      setDataInicio(meta.data_inicio ?? todayISO());
      setDataFim(meta.data_fim ?? "");
      setIsInverse(!!meta.is_inverse);
    } else {
      setNome("");
      setDescricao("");
      setArea(AREAS[0]);
      setResponsavelId("__none__");
      setMetricType("quantidade");
      setValorAlvo("");
      setUnidade("");
      setPeriodicidade("mensal");
      setDataInicio(todayISO());
      setDataFim("");
      setIsInverse(false);
    }
  }, [open, meta]);

  const changeMetricType = (v: string) => {
    const t = v as MetricType;
    setMetricType(t);
    const next = METRIC_CONFIG[t];
    // Nunca herda unidade de outro tipo (evita "R$" em meta de quantidade).
    if (next.unidadeFixa) setUnidade(next.unidadeFixa);
    else if (next.unidadeOpcoes) setUnidade(next.unidadeOpcoes[0]);
    else setUnidade("");

    if (t === "projeto") {
      setValorAlvo("0");
      setIsInverse(false);
    } else {
      setValorAlvo("");
    }
  };

  const resolveUnidade = () => cfg.unidadeFixa ?? unidade.trim();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const projetoAutomatico = metricType === "projeto";
    const valor = projetoAutomatico
      ? isEdit
        ? Number(meta?.valor_alvo ?? 0)
        : 0
      : Number(valorAlvo.replace(/\./g, "").replace(",", "."));
    const unidadeFinal = resolveUnidade();

    if (!nome.trim()) return toast.error("Informe o nome da meta.");
    if (!area) return toast.error("Selecione uma área.");
    if (!metricType) return toast.error("Escolha como esta meta será medida.");
    if (!projetoAutomatico && (!Number.isFinite(valor) || valor <= 0))
      return toast.error(`${cfg.alvoLabel} precisa ser um número positivo.`);
    if (!unidadeFinal)
      return toast.error(cfg.unidadeLabel ? `Informe: ${cfg.unidadeLabel}` : "Informe a unidade.");
    if (!dataInicio || !dataFim) return toast.error("Defina datas de início e fim.");
    if (dataFim < dataInicio) return toast.error("Data fim precisa ser após início.");

    const payload = {
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      area,
      responsavel_id: responsavelId === "__none__" ? null : responsavelId,
      valor_alvo: valor,
      unidade: unidadeFinal,
      metric_type: metricType,
      periodicidade: periodicidade as "mensal" | "trimestral" | "anual",
      data_inicio: dataInicio,
      data_fim: dataFim,
      is_inverse: projetoAutomatico ? false : isInverse,
    };

    try {
      if (isEdit && meta) {
        await updateMeta.mutateAsync({ id: meta.id as string, patch: payload });
        toast.success("Meta atualizada com sucesso");
      } else {
        await createMeta.mutateAsync({ ...payload, valor_atual: 0 });
        toast.success("Meta criada com sucesso");
      }
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar meta";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar meta" : "Nova meta"}</DialogTitle>
          <DialogDescription>
            Defina como a meta será medida, o alvo e a janela. O status é calculado automaticamente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome da meta *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Converter 2 mentorados"
              required
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Área *</Label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AREAS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem responsável</SelectItem>
                  {membros.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Como esta meta será medida? *</Label>
            <Select value={metricType} onValueChange={changeMetricType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METRIC_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {METRIC_CONFIG[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{cfg.ajuda}</p>
          </div>

          {metricType === "projeto" ? (
            <div className="rounded-xl border border-[var(--brand-accent)]/30 bg-[var(--brand-accent-soft)]/50 p-4">
              <div className="text-sm font-semibold text-[var(--brand-primary)]">
                Etapas calculadas automaticamente
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Cada plano de ação vinculado a esta meta será uma nova etapa. Você não precisa
                definir o total agora.
              </p>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div className="rounded-lg bg-background/70 px-3 py-2">
                  <strong>1 plano vinculado</strong>
                  <span className="block text-muted-foreground">= 1 etapa do projeto</span>
                </div>
                <div className="rounded-lg bg-background/70 px-3 py-2">
                  <strong>Etapa concluída</strong>
                  <span className="block text-muted-foreground">
                    quando todas as ações do plano forem concluídas
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="alvo">{cfg.alvoLabel} *</Label>
                <div className="relative">
                  {cfg.prefixo && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {cfg.prefixo}
                    </span>
                  )}
                  <Input
                    id="alvo"
                    type="text"
                    inputMode="decimal"
                    value={valorAlvo}
                    onChange={(e) => setValorAlvo(e.target.value)}
                    placeholder={cfg.alvoPlaceholder}
                    className={cfg.prefixo ? "pl-10" : cfg.sufixo ? "pr-16" : undefined}
                    required
                  />
                  {cfg.sufixo && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {cfg.sufixo}
                    </span>
                  )}
                </div>
              </div>

              {cfg.unidadeFixa ? (
                <div className="space-y-1.5">
                  <Label>Unidade</Label>
                  <div className="h-10 flex items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                    {cfg.unidadeFixa} · definida automaticamente
                  </div>
                </div>
              ) : cfg.unidadeOpcoes ? (
                <div className="space-y-1.5">
                  <Label>{cfg.unidadeLabel} *</Label>
                  <Select value={unidade || cfg.unidadeOpcoes[0]} onValueChange={setUnidade}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {cfg.unidadeOpcoes.map((u) => (
                        <SelectItem key={u} value={u} className="capitalize">
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="unidade">{cfg.unidadeLabel} *</Label>
                  <Input
                    id="unidade"
                    value={unidade}
                    onChange={(e) => setUnidade(e.target.value)}
                    placeholder={cfg.unidadePlaceholder}
                    required
                  />
                  {cfg.unidadeAjuda && (
                    <p className="text-xs text-muted-foreground">{cfg.unidadeAjuda}</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Periodicidade *</Label>
              <Select value={periodicidade} onValueChange={setPeriodicidade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODICIDADES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inicio">Início *</Label>
              <Input
                id="inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fim">Fim *</Label>
              <Input
                id="fim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                required
              />
            </div>
          </div>

          {metricType !== "projeto" && (
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3 bg-muted/30">
              <div className="space-y-0.5">
                <Label className="cursor-pointer">Meta inversa (menor é melhor)</Label>
                <p className="text-xs text-muted-foreground">
                  Para churn, tempo de resposta, custos, etc.
                </p>
              </div>
              <Switch checked={isInverse} onCheckedChange={setIsInverse} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição (opcional)</Label>
            <Textarea
              id="desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Contexto, fórmula de cálculo, fonte de dados…"
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              style={{ backgroundColor: "var(--color-blue)", color: "white" }}
              className="hover:opacity-90"
            >
              {saving ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar meta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
