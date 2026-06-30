import type { Status } from "@/lib/metas";
import { STATUS_COLOR } from "@/lib/metas";

/** 0..1 progress bar tinted by status. */
export function ProgressBar({
  value,
  status,
  height = 8,
}: {
  value: number;
  status: Status;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const c = STATUS_COLOR[status];
  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ height, backgroundColor: "hsl(var(--secondary))" }}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: c.fg }}
      />
    </div>
  );
}
