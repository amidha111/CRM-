import { useMemo } from "react";
import { OPEN_STAGES, STAGE_LABELS, type Actor, type Opportunity } from "../types";
import { completeNextAction } from "../lib/store";
import { daysSince, dueStatus, formatMoney, relativeTime } from "../lib/format";
import { DueBadge, EmptyCard, StagePill } from "../components/ui";

export function DashboardPage({
  opps,
  actor,
  onOpenOpp,
}: {
  opps: Opportunity[];
  actor: Actor;
  onOpenOpp: (id: string) => void;
}) {
  const open = useMemo(() => opps.filter((o) => OPEN_STAGES.includes(o.stage)), [opps]);

  const stats = useMemo(() => {
    const quarterStart = new Date();
    quarterStart.setMonth(Math.floor(quarterStart.getMonth() / 3) * 3, 1);
    quarterStart.setHours(0, 0, 0, 0);
    const wonThisQuarter = opps
      .filter((o) => o.stage === "closed_won" && o.updatedAt >= quarterStart)
      .reduce((s, o) => s + o.amount, 0);
    const dueToday = open.filter(
      (o) => o.nextAction && dueStatus(o.nextAction.dueDate) !== "upcoming",
    ).length;
    return {
      pipeline: open.reduce((s, o) => s + o.amount, 0),
      openCount: open.length,
      wonThisQuarter,
      dueToday,
    };
  }, [opps, open]);

  const byStage = useMemo(
    () =>
      OPEN_STAGES.map((stage) => {
        const deals = open.filter((o) => o.stage === stage);
        return { stage, count: deals.length, total: deals.reduce((s, o) => s + o.amount, 0) };
      }),
    [open],
  );
  const maxTotal = Math.max(1, ...byStage.map((b) => b.total));

  const dueList = useMemo(
    () =>
      open
        .filter((o) => o.nextAction)
        .sort((a, b) => a.nextAction!.dueDate.getTime() - b.nextAction!.dueDate.getTime())
        .slice(0, 6),
    [open],
  );

  const stale = useMemo(() => open.filter((o) => daysSince(o.updatedAt) >= 14), [open]);

  if (opps.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <header className="border-b border-line px-8 py-4">
          <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
        </header>
        <EmptyCard icon="▦" title="No data yet" line="Add your first opportunity to see your pipeline." />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 px-8 py-4 backdrop-blur">
        <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
      </header>

      <div className="flex flex-col gap-6 p-8">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[
            { label: "Open Pipeline", value: formatMoney(stats.pipeline) },
            { label: "Open Deals", value: String(stats.openCount) },
            { label: "Won This Quarter", value: formatMoney(stats.wonThisQuarter), cls: "text-success" },
            { label: "Actions Due / Overdue", value: String(stats.dueToday), cls: "text-gold-deep" },
          ].map((s) => (
            <div key={s.label} className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{s.label}</p>
              <p className={`mt-1 text-3xl font-bold ${s.cls ?? "text-ink"}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
          {/* Pipeline by stage */}
          <div className="card p-6">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">Pipeline by Stage</h2>
            <div className="flex flex-col gap-4">
              {byStage.map((b) => (
                <div key={b.stage}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="font-medium text-ink">
                      {STAGE_LABELS[b.stage]} <span className="text-muted">({b.count})</span>
                    </span>
                    <span className="font-bold text-ink">{formatMoney(b.total)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${b.total === maxTotal ? "bg-gold" : "bg-navy/30"}`}
                      style={{ width: `${(b.total / maxTotal) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Due & overdue */}
          <div className="card p-6">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">Due &amp; Overdue</h2>
            <div className="flex flex-col gap-3">
              {dueList.length === 0 && <p className="text-sm text-muted">No open next actions.</p>}
              {dueList.map((o) => (
                <div key={o.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => onOpenOpp(o.id)}
                      className="block truncate text-left text-sm font-semibold text-ink hover:underline"
                    >
                      {o.account || o.name}
                    </button>
                    <p className="truncate text-xs text-muted">{o.nextAction!.text}</p>
                  </div>
                  <DueBadge due={o.nextAction!.dueDate} />
                  <button
                    onClick={() => completeNextAction(o, null, actor)}
                    title="Mark done"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold-deep/40 text-gold-deep hover:bg-gold hover:text-navy"
                  >
                    ✓
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Going stale */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Going Stale (14+ days untouched)</h2>
          </div>
          {stale.length === 0 ? (
            <p className="px-6 py-5 text-sm text-muted">Nothing is going stale. Keep it that way.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <tbody>
                {stale.map((o) => (
                  <tr key={o.id} className="border-t border-slate-100">
                    <td className="px-6 py-3.5 font-semibold text-ink">{o.name}</td>
                    <td className="px-3 py-3.5">
                      <StagePill stage={o.stage} />
                    </td>
                    <td className="px-3 py-3.5 font-bold text-ink">{formatMoney(o.amount)}</td>
                    <td className="px-3 py-3.5 text-danger">{relativeTime(o.updatedAt)}</td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => onOpenOpp(o.id)}
                        className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-navy hover:brightness-105"
                      >
                        Open deal
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
