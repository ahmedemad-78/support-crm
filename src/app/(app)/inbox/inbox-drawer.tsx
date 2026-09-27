"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function InboxDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="mt-auto h-9 rounded-lg bg-brand-action text-sm font-semibold text-white">
        Create ticket
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(100vw,420px)]">
        <SheetHeader>
          <SheetTitle>Create ticket</SheetTitle>
          <SheetDescription>Name and phone come from the conversation. Finish the remaining fields, then save.</SheetDescription>
        </SheetHeader>
        <form className="flex flex-col gap-3 px-4" onSubmit={(event) => event.preventDefault()}>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Customer name
            <input className="h-9 rounded-lg border px-3 text-sm text-foreground" placeholder="From the conversation" disabled />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Phone
            <input className="h-9 rounded-lg border px-3 text-sm text-foreground" placeholder="From the conversation" disabled />
          </label>
          <p className="rounded-lg bg-[#fdf1de] px-3 py-2 text-sm text-[#a15c00]">
            If this customer already has an open ticket, you&apos;ll be asked to open that ticket instead of creating a duplicate.
          </p>
          <button type="button" disabled className="h-9 rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
            WhatsApp isn&apos;t connected yet
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
