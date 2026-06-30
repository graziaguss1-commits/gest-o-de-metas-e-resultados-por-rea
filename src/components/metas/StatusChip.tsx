import type { Status } from "@/lib/metas";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/metas";
import { cn } from "@/lib/utils";

export function StatusChip({
  status,
  size = "md",
  showDot = true,
  className,
}: {
  status: Status;
  size?: "sm" | "md";
  showDot?: boolean;
  className?: string;
}) {
  const c = STATUS_COLOR[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-full",
        size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1",
        className,
      )}
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {showDot && (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: c.fg }}
        />
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}

export function StatusDot({ status, className }: { status: Status; className?: string }) {
  const c = STATUS_COLOR[status];
  return (
    <span
      className={cn("inline-block h-2.5 w-2.5 rounded-full", className)}
      style={{ backgroundColor: c.fg }}
    />
  );
}
