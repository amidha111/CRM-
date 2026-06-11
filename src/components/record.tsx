import type { ReactNode } from "react";

/** Navigation callback shared by all record pages and lists. */
export type OpenRecord = (type: "opportunity" | "account" | "contact", id: string) => void;

export function Breadcrumb({ list, onBack, current }: { list: string; onBack: () => void; current: string }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm">
      <button onClick={onBack} className="font-semibold text-gold-deep hover:underline">
        {list}
      </button>
      <span className="text-muted">›</span>
      <span className="truncate text-muted">{current}</span>
    </nav>
  );
}

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
  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy text-xl text-gold">
            {icon}
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">{entity}</p>
            <h1 className="text-2xl font-bold text-ink">{title}</h1>
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="mt-5 flex flex-wrap gap-x-10 gap-y-3 border-t border-line pt-4">
        {highlights.map((h) => (
          <div key={h.label}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{h.label}</p>
            <div className="mt-0.5 text-sm font-semibold text-ink">{h.value}</div>
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
    <div className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
        {action}
      </div>
      {children}
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
