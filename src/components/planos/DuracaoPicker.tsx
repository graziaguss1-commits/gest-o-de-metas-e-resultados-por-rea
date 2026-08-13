import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DURACAO_PRESETS, formatDuracao } from "@/lib/agenda";

type Props = {
  value: number | null;
  onChange: (minutos: number | null) => void;
  /** Permite deixar "sem estimativa" (ações antigas continuam válidas). */
  allowEmpty?: boolean;
};

/** Seletor amigável de duração: presets + opção personalizada em h/min. */
export function DuracaoPicker({ value, onChange, allowEmpty = true }: Props) {
  const isPreset = value != null && (DURACAO_PRESETS as readonly number[]).includes(value);
  const [custom, setCustom] = useState(!isPreset && value != null);

  const horas = value != null ? Math.floor(value / 60) : 0;
  const minutos = value != null ? value % 60 : 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {DURACAO_PRESETS.map((p) => (
          <Button
            key={p}
            type="button"
            size="sm"
            variant={!custom && value === p ? "default" : "outline"}
            className="h-8 px-2.5 text-xs"
            onClick={() => {
              setCustom(false);
              onChange(p);
            }}
          >
            {formatDuracao(p)}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={custom ? "default" : "outline"}
          className="h-8 px-2.5 text-xs"
          onClick={() => {
            setCustom(true);
            if (value == null) onChange(60);
          }}
        >
          Personalizada
        </Button>
        {allowEmpty && (
          <Button
            type="button"
            size="sm"
            variant={value == null ? "default" : "ghost"}
            className="h-8 px-2.5 text-xs"
            onClick={() => {
              setCustom(false);
              onChange(null);
            }}
          >
            Sem estimativa
          </Button>
        )}
      </div>

      {custom && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={23}
            className="h-8 w-[70px]"
            value={horas}
            aria-label="Horas"
            onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0) * 60 + minutos)}
          />
          <span className="text-xs text-muted-foreground">h</span>
          <Input
            type="number"
            min={0}
            max={59}
            step={5}
            className="h-8 w-[70px]"
            value={minutos}
            aria-label="Minutos"
            onChange={(e) =>
              onChange(horas * 60 + Math.min(59, Math.max(0, Number(e.target.value) || 0)))
            }
          />
          <span className="text-xs text-muted-foreground">min</span>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        {value != null
          ? `Cada execução leva ${formatDuracao(value)}. Isso é diferente do prazo final da ação.`
          : "Sem estimativa de duração — a ação não poderá ser posicionada em horário no calendário."}
      </p>
    </div>
  );
}
