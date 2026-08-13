import { Button } from "@/components/ui/button";
import { DIAS_SEMANA, DIAS_UTEIS, TODOS_OS_DIAS } from "@/lib/agenda";

type Props = {
  value: number[] | null;
  onChange: (dias: number[] | null) => void;
  mode?: "multiple" | "single";
};

const same = (a: number[] | null, b: number[]) =>
  !!a && a.length === b.length && b.every((d) => a.includes(d));

/** Seleção múltipla para rotinas diárias ou única para rotinas semanais. */
export function DiasSemanaPicker({ value, onChange, mode = "multiple" }: Props) {
  const toggle = (dia: number) => {
    if (mode === "single") {
      onChange([dia]);
      return;
    }

    const atual = value ?? [];
    const next = atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia];
    onChange(next.length ? next.sort((a, b) => a - b) : null);
  };

  return (
    <div className="space-y-2">
      {mode === "multiple" && (
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={same(value, TODOS_OS_DIAS) ? "default" : "outline"}
            className="h-8 px-2.5 text-xs"
            onClick={() => onChange([...TODOS_OS_DIAS])}
          >
            Todos os dias
          </Button>
          <Button
            type="button"
            size="sm"
            variant={same(value, DIAS_UTEIS) ? "default" : "outline"}
            className="h-8 px-2.5 text-xs"
            onClick={() => onChange([...DIAS_UTEIS])}
          >
            Dias úteis (seg–sex)
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {DIAS_SEMANA.map((dia) => (
          <Button
            key={dia.valor}
            type="button"
            size="sm"
            variant={value?.includes(dia.valor) ? "secondary" : "ghost"}
            className="h-8 w-11 border px-0 text-xs"
            onClick={() => toggle(dia.valor)}
          >
            {dia.curto}
          </Button>
        ))}
      </div>
    </div>
  );
}
