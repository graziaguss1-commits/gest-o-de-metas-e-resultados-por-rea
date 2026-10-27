import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BlocoAgendaDia } from "@/hooks/useAgendaDoDia";
import { exigeTexto, MOTIVOS, type MotivoId } from "@/lib/motivos";

type Props = {
  aberta: boolean;
  blocos: BlocoAgendaDia[];
  /** Rótulo da data dos blocos, já formatado. */
  dataLabel: string;
  onFeito: (bloco: BlocoAgendaDia) => Promise<void> | void;
  onMotivo: (bloco: BlocoAgendaDia, motivo: MotivoId, observacao?: string) => Promise<void> | void;
  onFechar: () => void;
};

/**
 * Pendências do dia anterior, perguntadas uma vez quando ela entra no app.
 *
 * Existe porque o coach só enxerga o que ela registra. Bloco que passou sem
 * resposta é um buraco no histórico: o sistema não sabe se foi feito fora do
 * horário ou se não foi feito, e nenhuma das duas hipóteses pode ser chutada.
 *
 * A janela some conforme ela responde: cada bloco resolvido sai da lista, e
 * quando acaba a janela fecha sozinha. Fechar antes também é resposta
 * legítima — a pergunta volta amanhã, não vira cobrança.
 */
export function PendenciasDeOntem({
  aberta,
  blocos,
  dataLabel,
  onFeito,
  onMotivo,
  onFechar,
}: Props) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [outroDe, setOutroDe] = useState<string | null>(null);
  const [texto, setTexto] = useState("");

  const rodar = async (id: string, acao: () => Promise<void> | void) => {
    setOcupado(id);
    try {
      await acao();
      setOutroDe(null);
      setTexto("");
    } finally {
      setOcupado(null);
    }
  };

  return (
    <Dialog open={aberta} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ficou sem resposta {dataLabel}</DialogTitle>
          <DialogDescription>
            {blocos.length === 1
              ? "Um bloco passou sem você marcar. Foi feito?"
              : `${blocos.length} blocos passaram sem você marcar. Foram feitos?`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {blocos.map((bloco) => {
            const travado = ocupado === bloco.id;
            const pedindoTexto = outroDe === bloco.id;
            return (
              <div key={bloco.id} className="rounded-xl border p-3">
                <div className="text-sm font-semibold">{bloco.titulo}</div>
                <div className="text-[11px] text-muted-foreground">
                  {bloco.inicio}–{bloco.fim}
                  {bloco.area ? ` · ${bloco.area}` : ""}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    className="h-7 px-2.5 text-[11px]"
                    disabled={travado}
                    onClick={() => rodar(bloco.id, () => onFeito(bloco))}
                  >
                    {travado && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                    Fiz
                  </Button>
                  {MOTIVOS.map((m) => (
                    <Button
                      key={m.id}
                      size="sm"
                      variant={pedindoTexto && exigeTexto(m.id) ? "default" : "outline"}
                      className="h-7 px-2.5 text-[11px]"
                      disabled={travado}
                      onClick={() =>
                        exigeTexto(m.id)
                          ? setOutroDe(bloco.id)
                          : rodar(bloco.id, () => onMotivo(bloco, m.id))
                      }
                    >
                      {m.label}
                    </Button>
                  ))}
                </div>

                {pedindoTexto && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <input
                      autoFocus
                      maxLength={500}
                      placeholder="Qual foi o motivo"
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && texto.trim()) {
                          rodar(bloco.id, () => onMotivo(bloco, "outro", texto.trim()));
                        }
                      }}
                      className="h-7 flex-1 rounded-md border bg-background px-2 text-[11px]"
                    />
                    <Button
                      size="sm"
                      className="h-7 px-2.5 text-[11px]"
                      disabled={!texto.trim() || travado}
                      onClick={() => rodar(bloco.id, () => onMotivo(bloco, "outro", texto.trim()))}
                    >
                      Salvar
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Pode fechar e responder depois. Registrar o motivo não marca a tarefa
          como feita — rotina volta amanhã, tarefa única continua pendente.
        </p>
      </DialogContent>
    </Dialog>
  );
}
