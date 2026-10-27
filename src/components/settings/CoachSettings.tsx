import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useCoachPerfil, useSalvarCoachPerfil } from "@/hooks/useCoachPerfil";

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
  const [crencas, setCrencas] = useState("");
  const [sujo, setSujo] = useState(false);

  useEffect(() => {
    if (!perfil || sujo) return;
    setTom(perfil.tom);
    setRegras(perfil.regras);
    setVendas(perfil.perfil_vendas);
    setCrencas(perfil.mapa_crencas);
  }, [perfil, sujo]);

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
        <Label htmlFor="coach-crencas">Mapa de crenças por tipo de tarefa</Label>
        <Textarea
          id="coach-crencas"
          rows={10}
          value={crencas}
          onChange={(e) => {
            setCrencas(e.target.value);
            setSujo(true);
          }}
          placeholder="Um tipo de tarefa por linha: a crença que trava e a mensagem-base."
        />
        <p className="text-[11px] text-muted-foreground">
          É daqui que sai a linha 💭 de cada horário. A mensagem-base é ponto
          de partida: o coach adapta à tarefa do dia, nunca copia.
        </p>
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
                mapa_crencas: crencas,
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
              setCrencas(perfil.mapa_crencas);
    setCrencas(perfil.mapa_crencas);
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
