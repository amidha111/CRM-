import { useMemo, useState } from "react";
import { OPEN_STAGES, STAGE_LABELS, type Account, type Actor, type Contact, type Opportunity, type Stage } from "../types";
import { completeNextAction } from "../lib/store";
import { formatDate, formatMoney, relativeTime } from "../lib/format";
import { Avatar, DueBadge, EmptyCard, NbaChip, PrimaryButton, StagePill, inputCls } from "../components/ui";
import { NewOpportunityModal } from "../components/modals";
import type { OpenRecord } from "../components/record";
import { PageHeader } from "../components/pageChrome";
import { PIcon } from "../components/icons";

export function OpportunitiesPage({
  opps,
  contacts,
  accounts,
  actor,
  owners,
  onOpenRecord,
}: {
  opps: Opportunity[];
  contacts: Contact[];
  accounts: Account[];
  actor: Actor;
  owners: string[];
  onOpenRecord: OpenRecord;
}) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<Stage | "all" | "open">("open");
  const [showNew, setShowNew] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return opps.filter((o) => {
      if (stageFilter === "open" && !OPEN_STAGES.includes(o.stage)) return false;
      if (stageFilter !== "all" && stageFilter !== "open" && o.stage !== stageFilter) return false;
      if (q && !`${o.name} ${o.account} ${o.contactRoles.map((r) => r.name).join(" ")}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [opps, search, stageFilter]);

  const focus = useMemo(
    () =>
      opps
        .filter((o) => OPEN_STAGES.includes(o.stage) && o.nextAction)
        .sort((a, b) => a.nextAction!.dueDate.getTime() - b.nextAction!.dueDate.getTime())
        .slice(0, 3),
    [opps],
  );

  const totals = useMemo(() => {
    const open = filtered.filter((o) => OPEN_STAGES.includes(o.stage));
    return {
      total: filtered.reduce((s, o) => s + o.amount, 0),
      open: open.reduce((s, o) => s + o.amount, 0),
    };
  }, [filtered]);

  return (
    <div className="page-frame">
      <PageHeader
        icon="target"
        kind="Opportunities"
        title={stageFilter === "all" ? "All Pipeline" : "Open Pipeline"}
        meta={`${filtered.length} items · sorted by Close Date · updated now`}
        actions={
          <>
            <button className="icon-button" title="Refresh" type="button">
              <PIcon name="refresh" size={15} />
            </button>
            <span className="segmented" aria-label="View mode">
              <span className="on">
                <PIcon name="list" size={15} />
              </span>
              <span>
                <PIcon name="board" size={15} />
              </span>
            </span>
            <button className="toolbar-button hidden sm:inline-flex" type="button">
              <PIcon name="mail" size={15} />
              Import
            </button>
            <PrimaryButton onClick={() => setShowNew(true)}>
              <PIcon name="plus" size={15} sw={2.2} />
              New Opportunity
            </PrimaryButton>
          </>
        }
      />

      <div>
        {opps.length === 0 ? (
          <EmptyCard
            icon="target"
            title="No opportunities yet"
            line="Your pipeline starts with one deal."
            action={<PrimaryButton onClick={() => setShowNew(true)}>+ New Opportunity</PrimaryButton>}
          />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2.5">
              <span className="flex h-8 w-full items-center gap-2 rounded-lg border border-line bg-paper px-3 text-sm text-faint sm:w-[250px]">
                <PIcon name="search" size={14} />
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
                  placeholder="Search this list..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </span>
              <select
                className={`${inputCls} h-8 w-full py-1 sm:w-44`}
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value as Stage | "all" | "open")}
              >
                <option value="open">Open deals</option>
                <option value="all">All stages</option>
                {Object.entries(STAGE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <span className="filter-chip">
                <span className="text-gold-deep">Stage</span>
                <b>{stageFilter === "open" ? "Open" : stageFilter === "all" ? "All" : STAGE_LABELS[stageFilter]}</b>
                <PIcon name="x" size={11} sw={2.2} className="text-gold-deep" />
              </span>
              <span className="hidden items-center gap-1.5 px-1.5 text-xs font-semibold text-muted sm:inline-flex">
                <PIcon name="filter" size={13} />
                Add filter
              </span>
              <span className="ml-auto font-mono text-[11px] text-faint">
                {formatMoney(totals.total)} TOTAL · {formatMoney(totals.open)} OPEN
              </span>
            </div>
            {focus.length > 0 && (
              <div className="card mb-6 flex flex-wrap items-center gap-3 border-l-4 border-l-gold p-4">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-muted">★ Next Best Actions</span>
                {focus.map((o) => (
                  <NbaChip
                    key={o.id}
                    compact
                    text={`${o.account || o.name} — ${o.nextAction!.text}`}
                    due={o.nextAction!.dueDate}
                    onClick={() => onOpenRecord("opportunity", o.id)}
                    onDone={() => completeNextAction(o, null, actor)}
                  />
                ))}
              </div>
            )}

            <div className="card overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-line bg-tone/70 text-left font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">
                    <th className="w-[38px] px-5 py-3.5"><span className="block h-4 w-4 rounded border border-[#cfcaba]" /></th>
                    <th className="px-5 py-3.5">Opportunity</th>
                    <th className="px-3 py-3.5">Account</th>
                    <th className="px-3 py-3.5 text-right">Amount</th>
                    <th className="px-3 py-3.5">Stage</th>
                    <th className="px-3 py-3.5">Close Date</th>
                    <th className="px-3 py-3.5">Next Step</th>
                    <th className="px-3 py-3.5">Owner</th>
                    <th className="px-5 py-3.5 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => onOpenRecord("opportunity", o.id)}
                      className="cursor-pointer border-b border-line-soft last:border-0 hover:bg-gold-soft/35"
                    >
                      <td className="px-5 py-4">
                        <span className="block h-4 w-4 rounded border border-[#cfcaba] bg-paper" />
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-semibold text-gold-deep hover:underline">{o.name}</span>
                      </td>
                      <td className="px-3 py-4 text-muted">
                        <span className="inline-flex items-center gap-2">
                          <PIcon name="briefcase" size={13} className="text-faint" />
                          {o.account || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-right font-bold text-ink">{formatMoney(o.amount)}</td>
                      <td className="px-3 py-4">
                          <StagePill stage={o.stage} />
                        </td>
                      <td className="px-3 py-4 text-muted">
                        {o.closeDate ? (
                          <span className="inline-flex items-center gap-2 whitespace-nowrap">
                            <PIcon name="calendar" size={13} className="text-faint" />
                            {formatDate(o.closeDate)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-4">
                        {o.nextAction ? (
                          <span className="flex flex-col gap-1">
                            <NbaChip
                              compact
                              text={o.nextAction.text}
                              onDone={() => completeNextAction(o, null, actor)}
                            />
                            <span>
                              <DueBadge due={o.nextAction.dueDate} />
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <span className="flex items-center gap-2 text-ink">
                          <Avatar name={o.owner} size={24} />
                          {o.owner}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-faint">
                        <span className="sr-only">{relativeTime(o.updatedAt)}</span>
                        <PIcon name="more" size={16} />
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-5 py-10 text-center text-muted">
                        No deals match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="table-footer">
                <span>1-{filtered.length} OF {filtered.length}</span>
                <span>·</span>
                <span>50 PER PAGE</span>
                <span className="ml-auto flex items-center gap-1">
                  <span className="flex h-[26px] w-[26px] rotate-180 items-center justify-center rounded-md border border-line bg-paper text-muted">
                    <PIcon name="chevronRight" size={13} />
                  </span>
                  <span className="flex h-[26px] w-[26px] items-center justify-center rounded-md border border-line bg-paper text-muted">
                    <PIcon name="chevronRight" size={13} />
                  </span>
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {showNew && (
        <NewOpportunityModal
          contacts={contacts}
          accounts={accounts}
          owners={owners}
          actor={actor}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}
