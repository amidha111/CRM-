import type { ReactNode } from "react";
import { STAGE_LABELS, type Stage } from "../types";
import { dueLabel, dueStatus, initials } from "../lib/format";

export function StagePill({ stage }: { stage: Stage }) {
  const tone =
    stage === "closed_won"
      ? "bg-success-soft text-success"
      : stage === "closed_lost"
        ? "bg-danger-soft text-danger"
        : "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${tone}`}>
      {STAGE_LABELS[stage]}
    </span>
  );
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-navy text-white font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}

export function DueBadge({ due }: { due: Date }) {
  const status = dueStatus(due);
  const tone =
    status === "overdue"
      ? "text-danger bg-danger-soft"
      : status === "today"
        ? "text-gold-deep bg-gold-soft"
        : "text-muted bg-slate-100";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${tone}`}>
      {dueLabel(due)}
    </span>
  );
}

export function NbaChip({
  text,
  due,
  onDone,
  onClick,
  compact,
}: {
  text: string;
  due?: Date;
  onDone?: () => void;
  onClick?: () => void;
  compact?: boolean;
}) {
  return (
    <span
      onClick={onClick}
      role={onClick ? "button" : undefined}
      className={`inline-flex items-center gap-2 rounded-lg border border-gold bg-gold-soft text-ink ${compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"} ${onClick ? "cursor-pointer hover:bg-gold-soft/80" : ""}`}
    >
      <span aria-hidden className="text-gold-deep">★</span>
      <span className="font-medium">{text}</span>
      {due && <DueBadge due={due} />}
      {onDone && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDone();
          }}
          title="Mark done"
          className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-gold-deep/40 text-gold-deep hover:bg-gold hover:text-navy transition-colors"
        >
          ✓
        </button>
      )}
    </span>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  width = 560,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-[2px] p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card max-h-[90vh] w-full overflow-y-auto p-6"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-ink text-xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold";

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-navy shadow-sm hover:brightness-105 disabled:opacity-50 transition"
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-4 py-2 text-sm font-semibold text-muted hover:text-ink hover:bg-slate-100 transition"
    >
      {children}
    </button>
  );
}

export function EmptyCard({
  icon,
  title,
  line,
  action,
}: {
  icon: string;
  title: string;
  line: string;
  action?: ReactNode;
}) {
  return (
    <div className="card mx-auto mt-16 flex max-w-md flex-col items-center gap-3 p-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-soft text-2xl text-gold-deep">
        {icon}
      </span>
      <h2 className="text-2xl font-bold text-ink">{title}</h2>
      <p className="text-sm text-muted">{line}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
