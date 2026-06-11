import { useMemo, useState } from "react";
import {
  ROLE_LABELS,
  STAGES,
  STAGE_LABELS,
  type Activity,
  type Actor,
  type Opportunity,
  type Stage,
} from "../types";
import { changeStage, completeNextAction, removeStakeholder, setNextAction } from "../lib/store";
import { formatDate, formatMoney, relativeTime } from "../lib/format";
import { Avatar, DueBadge, Field, GhostButton, PrimaryButton, StagePill, inputCls } from "./ui";

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 12);
}

const TYPE_ICONS: Record<string, string> = {
  created: "✦",
  action_completed: "✓",
  action_set: "★",
  stage_change: "⇄",
  stakeholder_added: "+",
  stakeholder_removed: "−",
  call: "✆",
  email: "✉",
  meeting: "▣",
  note: "✎",
};

export function DetailPanel({
  opp,
  activities,
  oppCountByContact,
  actor,
  onClose,
  onLogActivity,
  onAddStakeholder,
}: {
  opp: Opportunity;
  activities: Activity[];
  oppCountByContact: Map<string, number>;
  actor: Actor;
  onClose: () => void;
  onLogActivity: () => void;
  onAddStakeholder: () => void;
}) {
  const timeline = useMemo(() => activities.filter((a) => a.oppId === opp.id), [activities, opp.id]);
  const [editingNba, setEditingNba] = useState(false);
  const [nbaText, setNbaText] = useState("");
  const [nbaDue, setNbaDue] = useState("");
  const closed = opp.stage === "closed_won" || opp.stage === "closed_lost";

  async function saveNba() {
    if (!nbaText.trim() || !nbaDue) return;
    await setNextAction(opp, { text: nbaText.trim(), dueDate: parseLocalDate(nbaDue) }, actor);
    setEditingNba(false);
    setNbaText("");
    setNbaDue("");
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[440px] flex-col overflow-y-auto rounded-l-3xl border-l border-line bg-white shadow-2xl">
      <div className="border-b border-line p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">{opp.account}</p>
            <h2 className="mt-1 text-2xl font-bold text-ink">{opp.name}</h2>
            <div className="mt-2 flex items-center gap-3">
              <StagePill stage={opp.stage} />
              <span className="text-lg font-bold text-ink">{formatMoney(opp.amount)}</span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close panel" className="text-xl text-muted hover:text-ink">
            ×
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted">Owner</p>
            <p className="font-medium text-ink">{opp.owner}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Close Date</p>
            <p className="font-medium text-ink">{formatDate(opp.closeDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Stage</p>
            <select
              className="mt-0.5 w-full rounded-md border border-line bg-white px-1.5 py-1 text-xs font-medium text-ink"
              value={opp.stage}
              onChange={(e) => changeStage(opp, e.target.value as Stage, actor)}
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stakeholders */}
      <div className="border-b border-line p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Stakeholders</h3>
          <button onClick={onAddStakeholder} className="text-sm font-semibold text-gold-deep hover:underline">
            + Add stakeholder
          </button>
        </div>
        <div className="flex flex-col gap-2.5">
          {opp.contactRoles.length === 0 && <p className="text-sm text-muted">No stakeholders linked yet.</p>}
          {opp.contactRoles.map((r) => {
            const otherDeals = (oppCountByContact.get(r.contactId) ?? 1) - 1;
            return (
              <div key={r.contactId} className="group flex items-center gap-3">
                <Avatar name={r.name} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    {r.name}
                    {r.isPrimary && (
                      <span title="Primary stakeholder" className="text-gold-deep">
                        ★
                      </span>
                    )}
                  </p>
                  {otherDeals > 0 && (
                    <p className="text-xs text-muted">
                      {otherDeals} other deal{otherDeals > 1 ? "s" : ""}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 whitespace-nowrap">
                  {ROLE_LABELS[r.role]}
                </span>
                <button
                  onClick={() => removeStakeholder(opp, r.contactId, actor)}
                  title="Remove from deal"
                  className="invisible text-muted hover:text-danger group-hover:visible"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Next Best Action */}
      <div className="border-b border-line p-6">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Next Best Action</h3>
        {closed ? (
          <p className="text-sm text-muted">Deal is closed — no next action.</p>
        ) : editingNba || !opp.nextAction ? (
          <div className="flex flex-col gap-3">
            <Field label="Action">
              <input
                className={inputCls}
                placeholder="e.g., Send revised SOW"
                value={nbaText}
                onChange={(e) => setNbaText(e.target.value)}
              />
            </Field>
            <Field label="Due">
              <input className={inputCls} type="date" value={nbaDue} onChange={(e) => setNbaDue(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <PrimaryButton onClick={saveNba} disabled={!nbaText.trim() || !nbaDue}>
                Save action
              </PrimaryButton>
              {opp.nextAction && <GhostButton onClick={() => setEditingNba(false)}>Cancel</GhostButton>}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-gold bg-gold-soft/60 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink">★ {opp.nextAction.text}</p>
              <div className="mt-1">
                <DueBadge due={opp.nextAction.dueDate} />
              </div>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => completeNextAction(opp, null, actor)}
                title="Mark done"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-gold-deep/40 text-gold-deep hover:bg-gold hover:text-navy"
              >
                ✓
              </button>
              <button
                onClick={() => {
                  setNbaText(opp.nextAction!.text);
                  setEditingNba(true);
                }}
                title="Edit"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted hover:text-ink"
              >
                ✎
              </button>
            </div>
          </div>
        )}
        <button onClick={onLogActivity} className="mt-4 text-sm font-semibold text-gold-deep hover:underline">
          + Log call / email / meeting / note
        </button>
      </div>

      {/* Timeline */}
      <div className="flex-1 p-6">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Activity Timeline</h3>
        <div className="flex flex-col gap-4">
          {timeline.length === 0 && <p className="text-sm text-muted">Nothing logged yet.</p>}
          {timeline.map((a) => (
            <div key={a.id} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-soft text-xs text-gold-deep">
                {TYPE_ICONS[a.type] ?? "•"}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-ink">{a.detail}</p>
                {a.note && <p className="mt-0.5 text-xs italic text-muted">"{a.note}"</p>}
                {a.link && (
                  <a href={a.link} target="_blank" rel="noreferrer" className="text-xs text-gold-deep underline">
                    {a.link}
                  </a>
                )}
                <p className="mt-0.5 text-xs text-muted">
                  {a.actor} · {relativeTime(a.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
