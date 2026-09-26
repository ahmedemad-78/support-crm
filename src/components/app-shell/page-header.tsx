export function PageHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background px-8">
      <h1 className="shrink-0 text-xl font-semibold tracking-tight">{title}</h1>
      <div className="flex flex-1 items-center justify-end gap-3">{actions}</div>
    </header>
  );
}
