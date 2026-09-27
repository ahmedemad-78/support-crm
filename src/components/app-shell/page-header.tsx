import { UserNotifications } from "./user-notifications";

export function PageHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <header className="flex min-h-24 shrink-0 flex-wrap items-center justify-between gap-4 border-b bg-background px-5 py-5 sm:px-8">
      <div className="space-y-1"><p className="eyebrow">SUPPORT WORKSPACE</p><h1 className="text-2xl font-semibold tracking-tight">{title}</h1></div>
      <div className="flex flex-wrap items-center gap-3">
        {actions}
        <UserNotifications />
      </div>
    </header>
  );
}
