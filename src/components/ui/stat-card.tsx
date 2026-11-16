import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type StatTone = "total" | "open" | "waiting" | "resolved" | "closed" | "reopened";

type Props = {
  tone: StatTone;
  icon: LucideIcon;
  label: string;
  value: number;
  note: string;
  /** Portion of `shareOf` this figure represents; omit both to hide the share and meter. */
  shareOf?: number;
  href: string;
  current?: boolean;
};

export function StatCard({ tone, icon: Icon, label, value, note, shareOf, href, current = false }: Props) {
  const share = shareOf === undefined ? null : shareOf > 0 ? Math.min(100, Math.round((value / shareOf) * 100)) : 0;
  return (
    <Link href={href} className="stat-card" data-tone={tone} aria-current={current ? "page" : undefined}>
      <span className="stat-card-top">
        <span className="stat-card-icon" aria-hidden="true"><Icon size={15} strokeWidth={2.25} /></span>
        <span className="stat-card-label">{label}</span>
      </span>
      <span className="stat-card-figure">
        <strong>{value.toLocaleString()}</strong>
        {share !== null && <span className="stat-card-share">{share}%</span>}
      </span>
      {share !== null && <span className="stat-card-meter" aria-hidden="true"><i style={{ width: `${share}%` }} /></span>}
      <small>{note}</small>
    </Link>
  );
}
