import type { ReactNode } from "react";
import { STAGE_LABELS, type Stage } from "../types";
import { dueLabel, dueStatus, initials } from "../lib/format";
import { PIcon, type IconName } from "./icons";

export function StagePill({ stage }: { stage: Stage }) {
  const tone =
    stage === "closed_won"
      ? "border-success/30 bg-success-soft text-success"
      : stage === "closed_lost"
        ? "border-danger/20 bg-danger-soft text-danger"
        : stage === "proposal" || stage === "negotiation"
          ? "border-gold/45 bg-gold-soft text-gold-deep"
          : "border-line bg-tone text-muted";
  const dot =
    stage === "closed_won"
      ? "bg-success"
      : stage === "closed_lost"
        ? "bg-danger"
        : stage === "proposal" || stage === "negotiation"
          ? "bg-gold"
          : "bg-[#b9b4a3]";
  return (
    <span className={`inline-flex h-[26px] items-center gap-2 rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {STAGE_LABELS[stage]}
    </span>
  );
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold shrink-0 ${
        size <= 27
          ? "bg-navy-soft text-white"
          : "bg-[linear-gradient(160deg,#f6d684,#d9a93d)] text-navy"
      }`}
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
      ? "border-danger/20 text-danger bg-danger-soft"
      : status === "today"
        ? "border-gold/40 text-gold-deep bg-gold-soft"
        : "border-line text-muted bg-tone";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.03em] whitespace-nowrap ${tone}`}>
      <PIcon name={status === "overdue" ? "flag" : "clock"} size={10} sw={2.2} />
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
      className={`inline-flex max-w-full items-center gap-2 rounded-md border border-gold/45 bg-gold-soft text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.5)] ${compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"} ${onClick ? "cursor-pointer hover:border-gold hover:bg-[#f6e7bd]" : ""}`}
    >
      <span aria-hidden className="text-gold-deep">★</span>
      <span className="min-w-0 truncate font-medium">{text}</span>
      {due && <DueBadge due={due} />}
      {onDone && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDone();
          }}
          title="Mark done"
          className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-md border border-gold-deep/40 text-gold-deep hover:bg-gold hover:text-navy transition-colors"
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
      <span className="mb-1 block font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-faint focus:border-gold focus:ring-2 focus:ring-gold/25";

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
      className="primary-gradient disabled:opacity-50 transition"
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
      className="inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-muted hover:text-ink hover:bg-tone transition"
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
  icon: IconName;
  title: string;
  line: string;
  action?: ReactNode;
}) {
  return (
    <div className="card mx-auto mt-16 flex max-w-md flex-col items-center gap-3 p-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-gold-soft text-gold-deep">
        <PIcon name={icon} size={27} sw={1.9} />
      </span>
      <h2 className="text-2xl font-bold text-ink">{title}</h2>
      <p className="text-sm text-muted">{line}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
