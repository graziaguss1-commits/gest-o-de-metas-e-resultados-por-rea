import { Button } from "@/components/ui/button";
import { DIAS_SEMANA, DIAS_UTEIS, TODOS_OS_DIAS } from "@/lib/agenda";

type Props = {
  value: number[] | null;
  onChange: (dias: number[] | null) => void;
  mode?: "multiple" | "single";
  maxSelections?: number;
  showPresets?: boolean;
};

const same = (a: number[] | null, b: number[]) =>
  !!a && a.length === b.length && b.every((d) => a.includes(d));

/** Seleção dos dias em que a rotina deve aparecer no calendário. */
export function DiasSemanaPicker({
  value,
  onChange,
  mode = "multiple",
  maxSelections,
  showPresets = true,
}: Props) {
  const toggle = (dia: number) => {
    if (mode === "single") {
      onChange([dia]);
      return;
    }

    const atual = value ?? [];
    if (
      !atual.includes(dia) &&
      maxSelections != null &&
      atual.length >= maxSelections
    ) {
      return;
    }
    const next = atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia];
    onChange(next.length ? next.sort((a, b) => a - b) : null);
  };

  return (
    <div className="space-y-2">
      {mode === "multiple" && showPresets && (
        <div className="flex flex-wrap gap-1.5">
          {(!maxSelections || maxSelections >= TODOS_OS_DIAS.length) && (
            <Button
              type="button"
              size="sm"
              variant={same(value, TODOS_OS_DIAS) ? "default" : "outline"}
              className="h-8 px-2.5 text-xs"
              onClick={() => onChange([...TODOS_OS_DIAS])}
            >
              Todos os dias
            </Button>
          )}
          {(!maxSelections || maxSelections >= DIAS_UTEIS.length) && (
            <Button
              type="button"
              size="sm"
              variant={same(value, DIAS_UTEIS) ? "default" : "outline"}
              className="h-8 px-2.5 text-xs"
              onClick={() => onChange([...DIAS_UTEIS])}
            >
              Dias úteis (seg–sex)
            </Button>
          )}
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
            disabled={
              !value?.includes(dia.valor) &&
              maxSelections != null &&
              (value?.length ?? 0) >= maxSelections
            }
          >
            {dia.curto}
          </Button>
        ))}
      </div>
    </div>
  );
}
