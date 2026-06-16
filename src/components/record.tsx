import type { ReactNode } from "react";
import { PIcon, type IconName } from "./icons";

/** Navigation callback shared by all record pages and lists. */
export type OpenRecord = (type: "opportunity" | "account" | "contact", id: string) => void;

export function Breadcrumb({ list, onBack, current }: { list: string; onBack: () => void; current: string }) {
  return (
    <nav className="flex items-center gap-2 text-[12.5px] text-muted">
      <button onClick={onBack} className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-paper text-muted hover:text-ink">
        <PIcon name="arrowLeft" size={14} />
      </button>
      <button onClick={onBack} className="hover:text-ink">
        {list}
      </button>
      <span className="text-faint">/</span>
      <span className="truncate font-semibold text-ink">{current}</span>
    </nav>
  );
}

const ENTITY_ICON: Record<string, IconName> = {
  Opportunity: "target",
  Account: "briefcase",
  Contact: "users",
};

/** SF Lightning-style record header: icon, entity label, title, action buttons, highlight fields. */
export function RecordHeader({
  icon,
  entity,
  title,
  actions,
  highlights,
}: {
  icon: string;
  entity: string;
  title: string;
  actions?: ReactNode;
  highlights: { label: string; value: ReactNode }[];
}) {
  void icon;
  return (
    <div className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="flex items-center gap-3.5">
          <span className="object-tile">
            <PIcon name={ENTITY_ICON[entity] ?? "target"} size={21} sw={1.9} />
          </span>
          <div>
            <p className="page-kind">{entity}</p>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-bold leading-tight tracking-[-0.015em] text-ink">{title}</h1>
              <PIcon name="star" size={16} className="text-gold" />
            </div>
          </div>
        </div>
        <span className="min-w-0 flex-1" />
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="grid border-t border-line-soft bg-tone sm:grid-cols-2 lg:grid-cols-4">
        {highlights.map((h) => (
          <div key={h.label} className="border-r border-line-soft px-5 py-3 last:border-r-0">
            <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">{h.label}</p>
            <div className="mt-1 flex items-center gap-2 text-[15px] font-bold text-ink">{h.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RecordSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="panel">
      <div className="panel-top">
        <PIcon name="list" size={15} />
        <h2>{title}</h2>
        <span className="min-w-0 flex-1" />
        {action}
      </div>
      <div className="p-[18px] pt-2">{children}</div>
    </div>
  );
}

export function RecordLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="font-semibold text-gold-deep hover:underline">
      {children}
    </button>
  );
}
