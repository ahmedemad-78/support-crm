import { cn } from "@/lib/utils";
import { STATUS_LABELS, STATUS_STYLES, type TicketStatus } from "@/lib/tickets/constants";

export function StatusBadge({ status, size = "sm" }: { status: TicketStatus; size?: "sm" | "lg" }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full font-semibold",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "h-9 px-3.5 text-sm",
        style.chip,
      )}
    >
      <span className={cn("rounded-full", size === "sm" ? "size-1.5" : "size-2", style.dot)} />
      {STATUS_LABELS[status]}
    </span>
  );
}
