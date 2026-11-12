import { cn } from "@/lib/utils";
import { Check, CircleDashed, CircleSlash, Clock3, MessageSquare } from "lucide-react";
import { STATUS_LABELS, type TicketStatus } from "@/lib/tickets/constants";

const appearance={
  new:{icon:CircleDashed,style:"border-[#dde2d8] bg-[#f6f7f3] text-[#64705c]"},
  in_progress:{icon:Clock3,style:"border-[#e5dfcf] bg-[#faf8f1] text-[#7b6944]"},
  awaiting_customer:{icon:MessageSquare,style:"border-[#e2dce8] bg-[#f7f5fa] text-[#766582]"},
  resolved:{icon:Check,style:"border-[#d9e4d5] bg-[#f1f6f0] text-[#4b7052]"},
  closed:{icon:CircleSlash,style:"border-[#e0e1dc] bg-[#f6f6f3] text-[#686d61]"},
};

export function StatusBadge({ status, size = "sm" }: { status: TicketStatus; size?: "sm" | "lg" }) {
  const {icon:Icon,style}=appearance[status];
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-md border font-medium",
        size === "sm" ? "px-2 py-1 text-xs" : "min-h-9 px-3 py-1.5 text-sm",
        style,
      )}
    >
      <Icon aria-hidden="true" strokeWidth={1.5} className={cn("shrink-0",size==="sm"?"size-3.5":"size-4")}/>
      {STATUS_LABELS[status]}
    </span>
  );
}
