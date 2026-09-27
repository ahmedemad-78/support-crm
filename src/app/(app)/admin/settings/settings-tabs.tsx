"use client";

import { useState, useTransition } from "react";
import { Archive, Check, Pencil, Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  addListItem,
  renameListItem,
  saveNotificationEmails,
  setListItemActive,
  type ActionResult,
  type ListTable,
} from "./actions";

type ListItem = { id: number; name: string; is_active: boolean };

const LISTS: { table: ListTable; label: string; hint: string; addLabel: string }[] = [
  {
    table: "issue_categories",
    label: "Issue categories",
    hint: "Technical Support picks one on every ticket. The dashboard groups resolution time by category.",
    addLabel: "Add category",
  },
  {
    table: "root_causes",
    label: "Root causes",
    hint: "What actually caused the problem. The dashboard ranks the most recurring ones.",
    addLabel: "Add root cause",
  },
  {
    table: "cities",
    label: "Cities",
    hint: "Options for the City field on the ticket form.",
    addLabel: "Add city",
  },
];

export function SettingsTabs({
  lists,
  notificationEmails,
}: {
  lists: Record<ListTable, ListItem[]>;
  notificationEmails: string[];
}) {
  return (
    <Tabs defaultValue="issue_categories" className="gap-4 bg-background px-8 py-5">
      <TabsList variant="line" className="h-auto max-w-full flex-wrap justify-start gap-y-2">
        {LISTS.map((l) => (
          <TabsTrigger key={l.table} value={l.table}>
            {l.label}
            <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
              {lists[l.table].filter((i) => i.is_active).length}
            </span>
          </TabsTrigger>
        ))}
        <TabsTrigger value="notifications">Notification email</TabsTrigger>
      </TabsList>

      {LISTS.map((l) => (
        <TabsContent key={l.table} value={l.table}>
          <ListEditor table={l.table} items={lists[l.table]} hint={l.hint} addLabel={l.addLabel} />
        </TabsContent>
      ))}
      <TabsContent value="notifications">
        <NotificationEmails initial={notificationEmails} />
      </TabsContent>
    </Tabs>
  );
}

function useAction() {
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<ActionResult>, onOk?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
        onOk?.();
      } else {
        toast.error(result.error);
      }
    });
  }
  return { pending, run };
}

function ListEditor({
  table,
  items,
  hint,
  addLabel,
}: {
  table: ListTable;
  items: ListItem[];
  hint: string;
  addLabel: string;
}) {
  const [newName, setNewName] = useState("");
  const { pending, run } = useAction();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {hint} Archiving hides a value from new tickets but keeps it on old ones.
      </p>

      <form
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addListItem(table, newName), () => setNewName(""));
        }}
      >
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" className="h-9" />
        <Button type="submit" disabled={pending || !newName.trim()} size="lg">
          <Plus />
          {addLabel}
        </Button>
      </form>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="w-32 px-4 py-3">Status</th>
              <th className="w-24 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <ListRow key={item.id} table={table} item={item} />
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                  Nothing here yet — add the first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ListRow({ table, item }: { table: ListTable; item: ListItem }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const { pending, run } = useAction();

  return (
    <tr className={cn("border-t", !item.is_active && "text-muted-foreground")}>
      <td className="px-4 py-2.5">
        {editing ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => renameListItem(table, item.id, name), () => setEditing(false));
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 max-w-sm" autoFocus />
            <Button type="submit" size="icon-sm" variant="ghost" disabled={pending} title="Save">
              <Check />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              title="Cancel"
              onClick={() => {
                setName(item.name);
                setEditing(false);
              }}
            >
              <X />
            </Button>
          </form>
        ) : (
          <span className="font-medium">{item.name}</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
            item.is_active ? "bg-brand-tint text-brand-action" : "bg-status-closed-bg text-status-closed",
          )}
        >
          {item.is_active ? "Active" : "Archived"}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" title="Rename" onClick={() => setEditing(true)} disabled={editing}>
            <Pencil />
          </Button>
          {item.is_active ? (
            <Button
              size="icon-sm"
              variant="ghost"
              title="Archive"
              disabled={pending}
              onClick={() => run(() => setListItemActive(table, item.id, false))}
            >
              <Archive />
            </Button>
          ) : (
            <Button
              size="icon-sm"
              variant="ghost"
              title="Restore"
              disabled={pending}
              onClick={() => run(() => setListItemActive(table, item.id, true))}
            >
              <RotateCcw className="text-brand-action" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function NotificationEmails({ initial }: { initial: string[] }) {
  const [value, setValue] = useState(initial.join("\n"));
  const { pending, run } = useAction();

  return (
    <form
      className="flex max-w-lg flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveNotificationEmails(value));
      }}
    >
      <Label htmlFor="emails" className="text-sm font-semibold">
        Who gets an email when a new ticket is created
      </Label>
      <Textarea
        id="emails"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        placeholder="support@selaheltelmeez.com"
      />
      <p className="text-xs text-muted-foreground">One address per line, up to 10. In-app notifications go to all Technical Support users regardless.</p>
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Saving…" : "Save recipients"}
      </Button>
    </form>
  );
}
