import { useMemo, useState } from "react";
import { ACTIVITY_TYPE_LABELS, type Activity, type ActivityType, type Opportunity } from "../types";
import { dayHeading } from "../lib/format";
import { EmptyCard, StagePill, inputCls } from "../components/ui";
import { PageHeader } from "../components/pageChrome";

const TYPE_ICONS: Record<string, { icon: string; cls: string }> = {
  created: { icon: "✦", cls: "bg-gold-soft text-gold-deep" },
  action_completed: { icon: "✓", cls: "bg-success-soft text-success" },
  action_set: { icon: "★", cls: "bg-gold-soft text-gold-deep" },
  stage_change: { icon: "⇄", cls: "bg-tone text-muted" },
  stakeholder_added: { icon: "+", cls: "bg-tone text-muted" },
  stakeholder_removed: { icon: "−", cls: "bg-tone text-muted" },
  call: { icon: "✆", cls: "bg-gold-soft text-gold-deep" },
  email: { icon: "✉", cls: "bg-gold-soft text-gold-deep" },
  meeting: { icon: "▣", cls: "bg-gold-soft text-gold-deep" },
  note: { icon: "✎", cls: "bg-tone text-muted" },
};

export function ActivityLogPage({
  activities,
  opps,
  onOpenOpp,
}: {
  activities: Activity[];
  opps: Opportunity[];
  onOpenOpp: (oppId: string) => void;
}) {
  const [typeFilter, setTypeFilter] = useState<ActivityType | "all">("all");
  const [oppFilter, setOppFilter] = useState<string>("all");
  const [shown, setShown] = useState(50);

  const filtered = useMemo(
    () =>
      activities.filter(
        (a) => (typeFilter === "all" || a.type === typeFilter) && (oppFilter === "all" || a.oppId === oppFilter),
      ),
    [activities, typeFilter, oppFilter],
  );

  const groups = useMemo(() => {
    const byDay = new Map<string, Activity[]>();
    for (const a of filtered.slice(0, shown)) {
      const key = dayHeading(a.createdAt);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(a);
    }
    return [...byDay.entries()];
  }, [filtered, shown]);

  return (
    <div className="page-frame">
      <PageHeader icon="activity" kind="Activity" title="Activity Log" meta={`${filtered.length} events`} />
      <div className="flex flex-wrap items-center gap-2.5">
        <select
          className={`${inputCls} h-8 w-full py-1 sm:w-48`}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ActivityType | "all")}
        >
          <option value="all">All types</option>
          {Object.entries(ACTIVITY_TYPE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <select className={`${inputCls} h-8 w-full py-1 sm:w-56`} value={oppFilter} onChange={(e) => setOppFilter(e.target.value)}>
          <option value="all">All opportunities</option>
          {opps.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <span className="ml-auto font-mono text-[11px] text-faint">{filtered.length} EVENTS</span>
      </div>

      <div className="mx-auto w-full max-w-3xl">
        {filtered.length === 0 ? (
          <EmptyCard
            icon="activity"
            title="Nothing logged yet"
            line="Activity appears here automatically as you work your deals."
          />
        ) : (
          <>
            {groups.map(([day, items]) => (
              <section key={day} className="mb-6">
                <h2 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wide text-muted">{day}</h2>
                <div className="flex flex-col gap-2">
                  {items.map((a) => {
                    const t = TYPE_ICONS[a.type] ?? { icon: "•", cls: "bg-tone text-muted" };
                    return (
                      <div key={a.id} className="card flex items-start gap-3 p-4">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm ${t.cls}`}>
                          {t.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-ink">
                            <span className="font-semibold">{a.actor}</span> — {a.detail} ·{" "}
                            <button
                              className="font-semibold text-gold-deep hover:underline"
                              onClick={() => onOpenOpp(a.oppId)}
                            >
                              {a.oppName}
                            </button>{" "}
                            <span className="text-muted">({a.account})</span>
                          </p>
                          {a.type === "stage_change" && a.fromStage && a.toStage && (
                            <p className="mt-1.5 flex items-center gap-2 text-xs">
                              <StagePill stage={a.fromStage} /> → <StagePill stage={a.toStage} />
                            </p>
                          )}
                          {a.note && <p className="mt-1 text-xs italic text-muted">"{a.note}"</p>}
                        </div>
                        <span className="shrink-0 text-xs text-muted">
                          {a.createdAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
            {filtered.length > shown && (
              <button
                onClick={() => setShown((s) => s + 50)}
                className="mx-auto block rounded-md border border-line bg-paper px-5 py-2 text-sm font-semibold text-muted hover:bg-tone hover:text-ink"
              >
                Load older activity
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
