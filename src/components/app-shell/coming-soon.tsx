import Image from "next/image";

export function ComingSoon({ title, milestone }: { title: string; milestone: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
      <Image
        src="/brand/mascot.jpg"
        alt=""
        width={220}
        height={190}
        className="h-[190px] w-auto object-contain mix-blend-multiply"
      />
      <h2 className="text-lg font-semibold">{title} is being built</h2>
      <p className="max-w-md text-sm text-muted-foreground">This screen arrives in {milestone}.</p>
    </div>
  );
}
