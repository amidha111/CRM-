import { useMemo, useState } from "react";
import { OPEN_STAGES, STAGE_LABELS, type Account, type Actor, type Contact, type Activity, type Opportunity, type Stage } from "../types";
import { completeNextAction } from "../lib/store";
import { formatMoney, relativeTime } from "../lib/format";
import { Avatar, DueBadge, EmptyCard, NbaChip, PrimaryButton, StagePill, inputCls } from "../components/ui";
import { DetailPanel } from "../components/DetailPanel";
import { AddStakeholderModal, LogActivityModal, NewOpportunityModal } from "../components/modals";

export function OpportunitiesPage({
  opps,
  activities,
  contacts,
  accounts,
  actor,
  owners,
  selectedId,
  onSelect,
}: {
  opps: Opportunity[];
  activities: Activity[];
  contacts: Contact[];
  accounts: Account[];
  actor: Actor;
  owners: string[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<Stage | "all" | "open">("open");
  const setSelectedId = onSelect;
  const [showNew, setShowNew] = useState(false);
  const [logFor, setLogFor] = useState<string | null>(null);
  const [addStakeholderFor, setAddStakeholderFor] = useState<string | null>(null);

  const selected = opps.find((o) => o.id === selectedId) ?? null;
  const logOpp = opps.find((o) => o.id === logFor) ?? null;
  const stakeholderOpp = opps.find((o) => o.id === addStakeholderFor) ?? null;

  const oppCountByContact = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of opps) for (const id of o.contactIds) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [opps]);

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

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-line bg-canvas/90 px-8 py-4 backdrop-blur">
        <h1 className="text-2xl font-bold text-ink">Opportunities</h1>
        <input
          className={`${inputCls} ml-auto max-w-64`}
          placeholder="Search deals…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={`${inputCls} w-44`}
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
        <PrimaryButton onClick={() => setShowNew(true)}>+ New Opportunity</PrimaryButton>
      </header>

      <div className="p-8">
        {opps.length === 0 ? (
          <EmptyCard
            icon="★"
            title="No opportunities yet"
            line="Your pipeline starts with one deal."
            action={<PrimaryButton onClick={() => setShowNew(true)}>+ New Opportunity</PrimaryButton>}
          />
        ) : (
          <>
            {focus.length > 0 && (
              <div className="card mb-6 flex flex-wrap items-center gap-3 border-l-4 border-l-gold p-4">
                <span className="text-xs font-bold uppercase tracking-wide text-muted">⚡ Next Best Actions</span>
                {focus.map((o) => (
                  <NbaChip
                    key={o.id}
                    compact
                    text={`${o.account || o.name} — ${o.nextAction!.text}`}
                    due={o.nextAction!.dueDate}
                    onClick={() => setSelectedId(o.id)}
                    onDone={() => completeNextAction(o, null, actor)}
                  />
                ))}
              </div>
            )}

            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    <th className="px-5 py-3.5">Opportunity</th>
                    <th className="px-3 py-3.5">Account</th>
                    <th className="px-3 py-3.5">Owner</th>
                    <th className="px-3 py-3.5 text-right">Amount</th>
                    <th className="px-3 py-3.5">Stage</th>
                    <th className="px-3 py-3.5">Next Best Action</th>
                    <th className="px-5 py-3.5 text-right">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => setSelectedId(o.id)}
                      className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-gold-soft/30"
                    >
                      <td className="px-5 py-4 font-semibold text-ink">{o.name}</td>
                      <td className="px-3 py-4 text-muted">{o.account || "—"}</td>
                      <td className="px-3 py-4">
                        <span className="flex items-center gap-2 text-ink">
                          <Avatar name={o.owner} size={24} />
                          {o.owner}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-right font-bold text-ink">{formatMoney(o.amount)}</td>
                      <td className="px-3 py-4">
                        <StagePill stage={o.stage} />
                      </td>
                      <td className="px-3 py-4">
                        {o.nextAction ? (
                          <NbaChip
                            compact
                            text={o.nextAction.text}
                            onDone={() => completeNextAction(o, null, actor)}
                          />
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                        {o.nextAction && (
                          <div className="mt-1">
                            <DueBadge due={o.nextAction.dueDate} />
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right text-xs text-muted">{relativeTime(o.updatedAt)}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-muted">
                        No deals match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {selected && (
        <DetailPanel
          opp={selected}
          activities={activities}
          oppCountByContact={oppCountByContact}
          actor={actor}
          onClose={() => setSelectedId(null)}
          onLogActivity={() => setLogFor(selected.id)}
          onAddStakeholder={() => setAddStakeholderFor(selected.id)}
        />
      )}
      {showNew && (
        <NewOpportunityModal
          contacts={contacts}
          accounts={accounts}
          owners={owners}
          actor={actor}
          onClose={() => setShowNew(false)}
        />
      )}
      {logOpp && <LogActivityModal opp={logOpp} actor={actor} onClose={() => setLogFor(null)} />}
      {stakeholderOpp && (
        <AddStakeholderModal
          opp={stakeholderOpp}
          contacts={contacts}
          actor={actor}
          onClose={() => setAddStakeholderFor(null)}
        />
      )}
    </div>
  );
}
