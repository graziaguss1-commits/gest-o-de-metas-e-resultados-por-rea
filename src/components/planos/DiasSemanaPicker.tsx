import { Button } from "@/components/ui/button";
import { DIAS_SEMANA, DIAS_UTEIS, TODOS_OS_DIAS } from "@/lib/agenda";

type Props = {
  value: number[] | null;
  onChange: (dias: number[] | null) => void;
};

const same = (a: number[] | null, b: number[]) =>
  !!a && a.length === b.length && b.every((d) => a.includes(d));

/** Dias de execução para ações recorrentes diárias. */
export function DiasSemanaPicker({ value, onChange }: Props) {
  const toggle = (dia: number) => {
    const atual = value ?? [];
    const next = atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia];
    onChange(next.length ? next.sort((a, b) => a - b) : null);
  };

  return (
    <div className="space-y-2">
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
      <div className="flex flex-wrap gap-1.5">
        {DIAS_SEMANA.map((d) => (
          <Button
            key={d.valor}
            type="button"
            size="sm"
            variant={value?.includes(d.valor) ? "secondary" : "ghost"}
            className="h-8 w-11 border px-0 text-xs"
            onClick={() => toggle(d.valor)}
          >
            {d.curto}
          </Button>
        ))}
      </div>
    </div>
  );
}
