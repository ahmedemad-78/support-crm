"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Inbox,
  List,
  LogOut,
  MessageCircle,
  PlusCircle,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type CurrentUser } from "@/lib/auth/roles";
import type { NavIcon, NavSection } from "./nav";

const ICONS: Record<NavIcon, LucideIcon> = {
  inbox: MessageCircle,
  tickets: Inbox,
  dashboard: BarChart3,
  users: Users,
  settings: Settings,
  "new-ticket": PlusCircle,
  "my-tickets": List,
};

export function Sidebar({ user, sections }: { user: CurrentUser; sections: NavSection[] }) {
  const pathname = usePathname();
  const initials = user.fullName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col gap-2 overflow-y-auto border-r border-sidebar-border bg-sidebar px-4 py-5">
      <Image
        src="/brand/logo.jpg"
        alt="Selah El Telmeez"
        width={132}
        height={52}
        className="mx-2 mb-4 h-[52px] w-auto object-contain mix-blend-multiply"
      />

      <nav className="flex flex-1 flex-col gap-1">
        {sections.map((section) => (
          <div key={section.heading} className="flex flex-col gap-1">
            <p className="px-3 pt-2 pb-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {section.heading}
            </p>
            {section.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex h-[38px] items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className={cn("size-[18px]", active ? "text-brand-action" : "text-muted-foreground")} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-2.5 px-2 py-1.5">
        <div className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-semibold text-white">
          {initials}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{user.fullName}</span>
          <span className="truncate text-xs text-muted-foreground">
            {ROLE_LABELS[user.role]}
            {user.isAdmin ? " · Admin" : ""}
          </span>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            title="Sign out"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" />
            <span className="sr-only">Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
