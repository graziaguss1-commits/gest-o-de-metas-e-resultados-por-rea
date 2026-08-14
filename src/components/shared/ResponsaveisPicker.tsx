import { Check, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MembroResumo } from "@/lib/metas";

function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}

export function ResponsaveisPicker({
  membros,
  value,
  onChange,
}: {
  membros: MembroResumo[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const alternar = (id: string) => {
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {membros.map((membro) => {
        const selecionado = value.includes(membro.id);
        return (
          <button
            key={membro.id}
            type="button"
            aria-pressed={selecionado}
            onClick={() => alternar(membro.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors",
              selecionado
                ? "border-[var(--color-blue)] bg-[var(--color-blue-soft)]"
                : "bg-card hover:bg-muted/50",
            )}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: "var(--color-blue)" }}
            >
              {iniciais(membro.full_name)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {membro.full_name}
            </span>
            {selecionado ? (
              <Check className="h-4 w-4 shrink-0" style={{ color: "var(--color-blue)" }} />
            ) : (
              <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ResponsavelSelect({
  membros,
  value,
  onChange,
  placeholder = "Selecione o responsável",
}: {
  membros: MembroResumo[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {membros.map((membro) => (
          <SelectItem key={membro.id} value={membro.id}>
            {membro.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function nomeResponsavel(membros: MembroResumo[], id?: string | null) {
  return membros.find((membro) => membro.id === id)?.full_name ?? "Sem responsável";
}
