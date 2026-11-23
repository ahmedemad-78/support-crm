"use client";

import { PasswordEye, useEyeLook } from "@/components/password-eye";
import { useRef, useState } from "react";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { Building2, ChartColumn, Check, Copy, Headset, MessagesSquare, PhoneCall, RefreshCw, School, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup } from "@/components/ui/radio-group";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, type Role } from "@/lib/auth/roles";

const ROLE_ICONS: Record<Role, LucideIcon> = {
  support_agent: Headset,
  moderation: MessagesSquare,
  call_center: PhoneCall,
  june_schools: School,
  business_development: Building2,
  manager: ChartColumn,
  department_member: Building2,
};

export function RoleIcon({ role, size = "md" }: { role: Role; size?: "sm" | "md" }) {
  const Icon = ROLE_ICONS[role];
  return (
    <span className="role-icon" data-role={role} data-size={size} aria-hidden="true">
      <Icon size={size === "sm" ? 13 : 15} strokeWidth={2.25} />
    </span>
  );
}

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
        <RadioPrimitive.Root key={role} value={role} className="role-option">
          <RoleIcon role={role} />
          <span className="role-option-text">
            <span>{ROLE_LABELS[role]}</span>
            <small>{ROLE_DESCRIPTIONS[role]}</small>
          </span>
          <RadioPrimitive.Indicator className="role-option-check">
            <Check size={12} strokeWidth={3} />
          </RadioPrimitive.Indicator>
        </RadioPrimitive.Root>
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
  const eyeRef = useRef<HTMLButtonElement>(null);
  const look = useEyeLook(eyeRef);

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
          onInput={(e) => look(e.currentTarget)}
          onSelect={(e) => look(e.currentTarget)}
          autoComplete="new-password"
          className="h-10 pr-20 font-mono"
        />
        <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
          <button
            ref={eyeRef}
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="eye-toggle is-compact"
            data-open={visible}
            aria-pressed={visible}
            aria-label={visible ? "Hide password" : "Show password"}
            title={visible ? "Hide password" : "Show password"}
          >
            <PasswordEye />
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
