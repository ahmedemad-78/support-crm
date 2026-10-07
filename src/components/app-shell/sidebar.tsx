"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  BarChart3,
  Inbox,
  List,
  LogOut,
  MessageCircle,
  Menu,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Headphones,
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

export function Sidebar({
  user,
  sections,
}: {
  user: CurrentUser;
  sections: NavSection[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const initials = user.fullName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const content = (
    <div className="support-nav-content flex h-full flex-col gap-2 overflow-y-auto bg-sidebar px-4 py-5">
      <Image
        src="/brand/logo.jpg"
        alt="Selah El Telmeez"
        width={1476}
        height={570}
        priority
        sizes="180px"
        className="support-company-logo mx-2 mb-4 h-[62px] w-auto self-start object-contain mix-blend-multiply"
        style={{ width: "auto" }}
      />

      <div className="support-nav-brand mx-2 mb-5 flex items-center gap-2 border-t pt-5 text-sm font-semibold">
        <Headphones className="size-4 shrink-0 text-brand-action" />
        <span>Support Center</span>
      </div>
      <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-5">
        {sections.map((section) => (
          <div key={section.heading} className="flex flex-col gap-1">
            <p className="px-3 pt-2 pb-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {section.heading}
            </p>
            {section.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "nav-link group flex h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-medium",
                    active
                      ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-white hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-[18px]",
                      active ? "text-brand-action" : "text-muted-foreground",
                    )}
                  />
                  <span className="support-nav-label min-w-0 flex-1 truncate">
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className="support-nav-badge rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-semibold text-brand-action">
                      {item.badge}
                    </span>
                  )}
                  {active && !item.badge && (
                    <ChevronRight className="ml-auto size-3.5" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-2.5 border-t px-2 pt-5 pb-1.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-action text-[13px] font-semibold text-white">
          {initials}
        </div>
        <div className="support-nav-user flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">
            {user.fullName}
          </span>
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
    </div>
  );

  return (
    <>
      <aside
        data-collapsed={collapsed}
        className="support-sidebar sticky top-0 hidden h-svh shrink-0 border-r border-sidebar-border lg:block"
      >
        <button
          type="button"
          className="support-nav-collapse"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-3.5" />
          ) : (
            <PanelLeftClose className="size-3.5" />
          )}
        </button>
        {content}
      </aside>
      <div className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-4 lg:hidden">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Image src="/brand/logo.jpg" alt="Selah El Telmeez" width={1476} height={570} priority sizes="120px" className="h-10 w-auto shrink-0 object-contain mix-blend-multiply" style={{ width: "auto" }} />
          <span className="sr-only">Support Center</span>
        </span>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            aria-label="Open navigation"
            className="rounded-lg border p-2.5"
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(85vw,280px)] gap-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">
              Your workspace pages and account.
            </SheetDescription>
            {content}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
