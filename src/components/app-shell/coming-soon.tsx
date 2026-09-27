import Image from "next/image";
import { Clock3 } from "lucide-react";

export function ComingSoon({ title, milestone }: { title: string; milestone: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-5 sm:p-10">
      <div className="flex w-full max-w-xl flex-col items-center gap-5 rounded-2xl border bg-background px-6 py-12 text-center sm:px-12">
      <span className="inline-flex items-center gap-2 rounded-full bg-brand-tint px-3 py-1.5 text-xs font-medium text-brand-action"><Clock3 className="size-3.5" /> On the roadmap</span>
      <Image
        src="/brand/mascot.jpg"
        alt=""
        width={220}
        height={190}
        className="h-[190px] w-auto object-contain mix-blend-multiply"
      />
      <div className="space-y-2"><h2 className="text-2xl font-semibold tracking-tight">{title} is taking shape</h2>
      <p className="max-w-md text-sm leading-6 text-muted-foreground">This workspace is planned for {milestone}. Your available tools are in the navigation.</p></div>
      </div>
    </div>
  );
}
