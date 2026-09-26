"use client";

import { useMemo, useState, useTransition } from "react";
import { Lock, Search, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { setUserActive, unlockUser, updateUser } from "./actions";
import { PasswordField, RoleOptions } from "./fields";

export type UserRow = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isAdmin: boolean;
  isActive: boolean;
  lockedUntil: string | null;
  lastSignInAt: string | null;
};

const ROLE_CHIP: Record<Role, string> = {
  support_agent: "bg-brand-tint text-brand-action",
  moderation: "bg-status-awaiting-bg text-status-awaiting",
  call_center: "bg-status-new-bg text-status-new",
  manager: "bg-status-progress-bg text-status-progress",
};

export function UsersTable({ rows, currentUserId }: { rows: UserRow[]; currentUserId: string }) {
  const [query, setQuery] = useState("");
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (showDeactivated || r.isActive) &&
        (!q || r.fullName.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)),
    );
  }, [rows, query, showDeactivated]);

  const deactivatedCount = rows.filter((r) => !r.isActive).length;
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4 bg-background px-8 py-5">
      <div className="flex items-center gap-2.5">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        {deactivatedCount > 0 && (
          <Button variant="outline" onClick={() => setShowDeactivated((v) => !v)}>
            {showDeactivated ? "Hide deactivated" : `Show deactivated (${deactivatedCount})`}
          </Button>
        )}
        <span className="flex-1 text-right text-sm text-muted-foreground">
          {rows.length - deactivatedCount} active users
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="w-60 px-4 py-3">Role</th>
              <th className="w-32 px-4 py-3">Status</th>
              <th className="w-36 px-4 py-3">Last sign-in</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.id}
                onClick={() => setSelectedId(row.id)}
                className={cn(
                  "cursor-pointer border-t hover:bg-muted/60",
                  selectedId === row.id && "bg-muted shadow-[inset_3px_0_0_var(--brand-action)]",
                  !row.isActive && "text-muted-foreground",
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-[34px] items-center justify-center rounded-full border bg-muted text-xs font-semibold text-muted-foreground">
                      {initials(row.fullName)}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {row.fullName}
                        {row.id === currentUserId && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">{row.email}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
                        ROLE_CHIP[row.role],
                      )}
                    >
                      {ROLE_LABELS[row.role]}
                    </span>
                    {row.isAdmin && (
                      <span className="rounded-full bg-foreground px-2 py-0.5 text-xs font-semibold text-background">
                        Admin
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusCell row={row} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatLastSignIn(row.lastSignInAt)}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  No users match &ldquo;{query}&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <EditUserSheet
        key={selected?.id}
        user={selected}
        isSelf={selected?.id === currentUserId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

function StatusCell({ row }: { row: UserRow }) {
  const [dot, label] = !row.isActive
    ? ["bg-status-closed", "Deactivated"]
    : row.lockedUntil
      ? ["bg-destructive", "Locked"]
      : ["bg-brand", "Active"];
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-[7px] rounded-full", dot)} />
      {label}
    </span>
  );
}

function EditUserSheet({ user, isSelf, onClose }: { user: UserRow | null; isSelf: boolean; onClose: () => void }) {
  const [role, setRole] = useState<Role>(user?.role ?? "moderation");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!user) return null;

  function run(action: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, close = false) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      setPassword("");
      if (close) onClose();
    });
  }

  const minutesLocked = user.lockedUntil ? minutesUntil(user.lockedUntil) : 0;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-[400px] flex-col gap-0 p-0 sm:max-w-[400px]">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>{user.fullName}</SheetTitle>
          <SheetDescription>{user.email}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          {user.lockedUntil && user.isActive && (
            <div className="flex gap-2.5 rounded-lg bg-[#fdecec] p-3">
              <Lock className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="flex flex-1 flex-col gap-1.5">
                <p className="text-[13px] font-semibold">Locked after 5 failed sign-ins</p>
                <p className="text-xs text-muted-foreground">
                  Unlocks automatically in {minutesLocked} min, or unlock now.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit bg-background"
                  disabled={pending}
                  onClick={() => run(() => unlockUser(user.email))}
                >
                  <Unlock />
                  Unlock now
                </Button>
              </div>
            </div>
          )}

          {!user.isActive && (
            <p className="rounded-lg bg-muted p-3 text-[13px] text-muted-foreground">
              This account is deactivated. Reactivate it to change the role or password.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-semibold">Role</p>
            <RoleOptions value={role} onChange={setRole} disabled={isSelf || !user.isActive} />
            {isSelf && <p className="text-xs text-muted-foreground">You can&apos;t change your own role.</p>}
          </div>

          {user.isActive && (
            <PasswordField
              label="Set a new password"
              value={password}
              onChange={setPassword}
              help={`Leave empty to keep the current password. Saving signs ${user.fullName.split(" ")[0]} out of all devices.`}
            />
          )}

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>

        <SheetFooter className="flex-row items-center gap-2.5 border-t px-6 py-4">
          {!isSelf &&
            (user.isActive ? (
              <Button
                variant="outline"
                className="text-destructive"
                disabled={pending}
                onClick={() => run(() => setUserActive(user.id, false), true)}
              >
                Deactivate
              </Button>
            ) : (
              <Button variant="outline" disabled={pending} onClick={() => run(() => setUserActive(user.id, true))}>
                Reactivate
              </Button>
            ))}
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {user.isActive && (
            <Button disabled={pending} onClick={() => run(() => updateUser({ userId: user.id, role, password }), true)}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function minutesUntil(iso: string) {
  return Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 60_000));
}

function formatLastSignIn(iso: string | null) {
  if (!iso) return "Never";
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
