import { useMemo } from "react";
import { OPEN_STAGES, STAGE_LABELS, type Actor, type Opportunity } from "../types";
import { completeNextAction } from "../lib/store";
import { daysSince, dueStatus, formatMoney, relativeTime } from "../lib/format";
import { DueBadge, EmptyCard, StagePill } from "../components/ui";
import { PageHeader } from "../components/pageChrome";
import { PIcon, type IconName } from "../components/icons";

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
        <header className="border-b border-line px-4 py-4 md:px-8">
          <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
        </header>
        <EmptyCard icon="chart" title="No data yet" line="Add your first opportunity to see your pipeline." />
      </div>
    );
  }

  return (
    <div className="page-frame">
      <PageHeader
        icon="chart"
        kind="Dashboard"
        title="Pipeline Health"
        meta="This quarter · updated now"
        actions={
          <>
            <button className="icon-button" type="button" title="Refresh">
              <PIcon name="refresh" size={15} />
            </button>
            <button className="toolbar-button" type="button">
              <PIcon name="calendar" size={14} />
              This quarter
            </button>
          </>
        }
      />

      <div className="flex flex-col gap-[14px]">
        {/* Stat cards */}
        <div className="grid gap-[14px] sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Open Pipeline", value: formatMoney(stats.pipeline), icon: "dollar" as IconName, tile: "bg-[#e8ecf5] text-navy-soft border-[#d5dcec]" },
            { label: "Open Deals", value: String(stats.openCount), icon: "target" as IconName, tile: "bg-[#e8ecf5] text-navy-soft border-[#d5dcec]" },
            { label: "Won This Quarter", value: formatMoney(stats.wonThisQuarter), icon: "trend" as IconName, cls: "text-success", tile: "bg-success-soft text-success border-success/25" },
            { label: "Actions Due / Overdue", value: String(stats.dueToday), icon: "zap" as IconName, cls: "text-gold-deep", tile: "bg-gold-soft text-gold-deep border-gold/35" },
          ].map((s) => (
            <div key={s.label} className="card flex items-start gap-3 p-4">
              <span className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] border ${s.tile}`}>
                <PIcon name={s.icon} size={17} />
              </span>
              <div>
                <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">{s.label}</p>
                <p className={`mt-0.5 text-[26px] font-bold leading-tight tracking-[-0.02em] ${s.cls ?? "text-ink"}`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-[14px] xl:grid-cols-[3fr_2fr]">
          {/* Pipeline by stage */}
          <div className="panel">
            <div className="panel-top">
              <PIcon name="chart" size={15} />
              <h2>Pipeline by Stage</h2>
              <span className="panel-count">OPEN · {formatMoney(stats.pipeline)}</span>
            </div>
            <div className="px-[18px] py-2">
              {byStage.map((b) => (
                <div key={b.stage} className="border-b border-line-soft py-2.5 last:border-0">
                  <div className="mb-2 flex items-baseline justify-between text-sm">
                    <span className="font-medium text-ink">
                      {STAGE_LABELS[b.stage]} <span className="text-muted">({b.count})</span>
                    </span>
                    <span className="font-bold text-ink">{formatMoney(b.total)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-line-soft">
                    <div
                      className={`h-full rounded-full ${b.total === maxTotal ? "bg-[linear-gradient(90deg,#ecbe4e,#f6d684)]" : "bg-[#c3c9d6]"}`}
                      style={{ width: `${(b.total / maxTotal) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Due & overdue */}
          <div className="panel">
            <div className="panel-top">
              <PIcon name="zap" size={15} />
              <h2>Due &amp; Overdue</h2>
              <span className="panel-count">{dueList.length}</span>
            </div>
            <div className="px-[18px] py-2">
              {dueList.length === 0 && <p className="text-sm text-muted">No open next actions.</p>}
              {dueList.map((o) => (
                <div key={o.id} className="flex items-center gap-3 border-b border-line-soft py-2.5 last:border-0">
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
                    className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-gold/50 bg-paper text-gold-deep hover:bg-gold hover:text-navy"
                  >
                    <PIcon name="check" size={13} sw={2.2} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Going stale */}
        <div className="card overflow-hidden">
          <div className="panel-top">
            <PIcon name="clock" size={15} />
            <h2>Going Stale</h2>
            <span className="panel-count">14+ DAYS UNTOUCHED</span>
          </div>
          {stale.length === 0 ? (
            <p className="px-6 py-5 text-sm text-muted">Nothing is going stale. Keep it that way.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <tbody>
                {stale.map((o) => (
                  <tr key={o.id} className="border-t border-line-soft">
                    <td className="px-6 py-3.5 font-semibold text-ink">{o.name}</td>
                    <td className="px-3 py-3.5">
                      <StagePill stage={o.stage} />
                    </td>
                    <td className="px-3 py-3.5 font-bold text-ink">{formatMoney(o.amount)}</td>
                    <td className="px-3 py-3.5 text-danger">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px]">
                        <PIcon name="flag" size={12} />
                        {relativeTime(o.updatedAt)}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => onOpenOpp(o.id)}
                        className="primary-gradient min-h-7 px-3 text-xs"
                      >
                        Open deal
                        <PIcon name="chevronRight" size={13} />
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
