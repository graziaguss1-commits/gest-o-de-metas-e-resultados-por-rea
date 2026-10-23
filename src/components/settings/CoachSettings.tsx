import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useCoachPerfil, useSalvarCoachPerfil } from "@/hooks/useCoachPerfil";
import { semanaDoPlano } from "../../../supabase/functions/whatsapp-agenda/logica";
import { isoLocal } from "@/lib/hoje";

const isoHoje = () => isoLocal(new Date());

/**
 * Ajuste do coach sem publicar função nenhuma: o texto que guia a mensagem
 * da manhã mora no banco, e esta tela é quem edita.
 */
export function CoachSettings() {
  const { data: perfil, isLoading } = useCoachPerfil();
  const salvar = useSalvarCoachPerfil();
  const [tom, setTom] = useState("");
  const [regras, setRegras] = useState("");
  const [vendas, setVendas] = useState("");
  const [plano, setPlano] = useState("");
  const [inicio, setInicio] = useState("");
  const [sujo, setSujo] = useState(false);

  useEffect(() => {
    if (!perfil || sujo) return;
    setTom(perfil.tom);
    setRegras(perfil.regras);
    setVendas(perfil.perfil_vendas);
    setPlano(perfil.plano_evolucao);
    setInicio(perfil.plano_inicio ?? "");
  }, [perfil, sujo]);

  const semanaAtual = semanaDoPlano(inicio || null, isoHoje());

  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (!perfil) return null;

  const persistir = async (patch: Parameters<typeof salvar.mutateAsync>[0], ok: string) => {
    try {
      await salvar.mutateAsync(patch);
      toast.success(ok);
      setSujo(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  };

  return (
    <div className="metasia-card space-y-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4 text-[var(--brand-accent)]" />
            Coach da manhã
          </h3>
          <p className="text-xs text-muted-foreground">
            Quando ligado, a mensagem das 7:30 no WhatsApp passa a ser escrita
            pelo Claude com a sua agenda do dia. Se o Claude falhar por
            qualquer motivo, o resumo de sempre é enviado no lugar.
          </p>
        </div>
        <Switch
          checked={perfil.ativo}
          onCheckedChange={(v) =>
            persistir({ ativo: v }, v ? "Coach ligado" : "Coach desligado")
          }
        />
      </div>

      <div className="space-y-1.5 border-t pt-4">
        <Label htmlFor="coach-tom">Como ele deve falar</Label>
        <Textarea
          id="coach-tom"
          rows={3}
          value={tom}
          onChange={(e) => {
            setTom(e.target.value);
            setSujo(true);
          }}
          placeholder="Tom, o que evitar, tamanho da mensagem."
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="coach-vendas">Perfil de vendas e padrão de trava</Label>
        <Textarea
          id="coach-vendas"
          rows={8}
          value={vendas}
          onChange={(e) => {
            setVendas(e.target.value);
            setSujo(true);
          }}
          placeholder="Como você funciona vendendo, como você trava e o que o coach deve fazer."
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="coach-plano">Plano de evolução, uma semana por vez</Label>
        <Textarea
          id="coach-plano"
          rows={4}
          value={plano}
          onChange={(e) => {
            setPlano(e.target.value);
            setSujo(true);
          }}
          placeholder="Semana 1 — tema. Semana 2 — tema."
        />
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Label htmlFor="coach-inicio" className="text-xs font-normal text-muted-foreground">
            Começou em
          </Label>
          <input
            id="coach-inicio"
            type="date"
            value={inicio}
            onChange={(e) => {
              setInicio(e.target.value);
              setSujo(true);
            }}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          />
          {inicio && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setInicio("");
                setSujo(true);
              }}
            >
              Encerrar plano
            </Button>
          )}
          <span className="text-[11px] text-muted-foreground">
            {semanaAtual
              ? `Hoje é a semana ${semanaAtual} de 4.`
              : inicio
                ? "As 4 semanas terminaram. O coach parou de cobrar o tema."
                : "Sem data, o coach não cobra tema de semana."}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="coach-regras">O que fazer em cada situação</Label>
        <Textarea
          id="coach-regras"
          rows={8}
          value={regras}
          onChange={(e) => {
            setRegras(e.target.value);
            setSujo(true);
          }}
          placeholder="Uma regra por linha."
        />
        <p className="text-[11px] text-muted-foreground">
          Essas instruções entram na mensagem toda manhã. Mudança aqui vale a
          partir do dia seguinte, sem precisar publicar nada.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          disabled={!sujo || salvar.isPending}
          onClick={() =>
            persistir(
              {
                tom,
                regras,
                perfil_vendas: vendas,
                plano_evolucao: plano,
                plano_inicio: inicio || null,
              },
              "Coach atualizado",
            )
          }
        >
          {salvar.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
        {sujo && (
          <Button
            variant="ghost"
            onClick={() => {
              setTom(perfil.tom);
              setRegras(perfil.regras);
              setVendas(perfil.perfil_vendas);
              setPlano(perfil.plano_evolucao);
              setInicio(perfil.plano_inicio ?? "");
              setSujo(false);
            }}
          >
            Descartar
          </Button>
        )}
      </div>
    </div>
  );
}
