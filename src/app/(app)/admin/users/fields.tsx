"use client";

import { useState } from "react";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, type Role } from "@/lib/auth/roles";

export function RoleOptions({
  value,
  onChange,
  disabled,
}: {
  value: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as Role)}
      disabled={disabled}
      className="flex flex-col gap-1.5"
    >
      {ROLES.map((role) => (
        <Label
          key={role}
          className={cn(
            "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 font-normal",
            value === role && "border-2 border-brand-action bg-brand-tint",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <RadioGroupItem value={role} />
          <span className="flex flex-col">
            <span className="text-[13px] font-semibold">{ROLE_LABELS[role]}</span>
            <span className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</span>
          </span>
        </Label>
      ))}
    </RadioGroup>
  );
}

export function PasswordField({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="new-password" className="text-[13px] font-semibold">
        {label}
      </Label>
      <div className="relative">
        <Input
          id="new-password"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          className="h-10 pr-16 font-mono"
        />
        <div className="absolute top-1/2 right-2 flex -translate-y-1/2 gap-1">
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            title={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
          <button
            type="button"
            disabled={!value}
            onClick={async () => {
              await navigator.clipboard.writeText(value);
              toast.success("Password copied");
            }}
            className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
            title="Copy password"
          >
            <Copy className="size-4" />
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          onChange(generatePassword());
          setVisible(true);
        }}
        className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-brand-action hover:underline"
      >
        <RefreshCw className="size-3.5" />
        Generate strong password
      </button>
      {help && <p className="text-xs leading-[18px] text-muted-foreground">{help}</p>}
    </div>
  );
}

function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(8));
  const part = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  const digits = String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, "0");
  return `Telmeez-${digits}-${part}`;
}
