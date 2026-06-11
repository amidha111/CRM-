import { useMemo, useState } from "react";
import {
  ROLE_LABELS,
  STAGES,
  STAGE_LABELS,
  type Account,
  type Activity,
  type Actor,
  type Contact,
  type Opportunity,
  type Stage,
} from "../types";
import { changeStage, completeNextAction, deleteOpportunity, removeStakeholder, setNextAction } from "../lib/store";
import { formatDate, formatMoney, relativeTime } from "../lib/format";
import { Avatar, DueBadge, Field, GhostButton, PrimaryButton, StagePill, inputCls } from "../components/ui";
import { Breadcrumb, RecordHeader, RecordLink, RecordSection, type OpenRecord } from "../components/record";
import { AddStakeholderModal, EditOpportunityModal, LogActivityModal } from "../components/modals";

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

/** SF Lightning-style sales path: chevron per stage, click to move the deal. */
function StagePath({ opp, actor }: { opp: Opportunity; actor: Actor }) {
  const currentIdx = STAGES.indexOf(opp.stage);
  return (
    <div className="card flex overflow-hidden p-1.5">
      {STAGES.map((s, i) => {
        const active = s === opp.stage;
        const done = i < currentIdx && opp.stage !== "closed_lost";
        const tone = active
          ? s === "closed_won"
            ? "bg-success text-white"
            : s === "closed_lost"
              ? "bg-danger text-white"
              : "bg-navy text-gold"
          : done
            ? "bg-gold-soft text-gold-deep"
            : "bg-slate-50 text-muted hover:bg-gold-soft/60";
        return (
          <button
            key={s}
            onClick={() => changeStage(opp, s as Stage, actor)}
            title={`Move to ${STAGE_LABELS[s]}`}
            className={`relative -ml-2 flex-1 px-4 py-2 text-xs font-semibold transition first:ml-0 ${tone}`}
            style={{
              clipPath:
                i === STAGES.length - 1
                  ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 10px 50%)"
                  : i === 0
                    ? "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)"
                    : "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)",
            }}
          >
            {STAGE_LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}

export function OpportunityRecordPage({
  opp,
  activities,
  contacts,
  accounts,
  opps,
  actor,
  owners,
  onBack,
  onOpenRecord,
}: {
  opp: Opportunity;
  activities: Activity[];
  contacts: Contact[];
  accounts: Account[];
  opps: Opportunity[];
  actor: Actor;
  owners: string[];
  onBack: () => void;
  onOpenRecord: OpenRecord;
}) {
  const timeline = useMemo(() => activities.filter((a) => a.oppId === opp.id), [activities, opp.id]);
  const [editingNba, setEditingNba] = useState(false);
  const [nbaText, setNbaText] = useState("");
  const [nbaDue, setNbaDue] = useState("");
  const [showLog, setShowLog] = useState(false);
  const [showAddStakeholder, setShowAddStakeholder] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete "${opp.name}"? Its activity history is deleted with it. This cannot be undone.`)) return;
    await deleteOpportunity(opp);
    onBack();
  }
  const closed = opp.stage === "closed_won" || opp.stage === "closed_lost";

  const oppCountByContact = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of opps) for (const id of o.contactIds) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [opps]);

  async function saveNba() {
    if (!nbaText.trim() || !nbaDue) return;
    await setNextAction(opp, { text: nbaText.trim(), dueDate: parseLocalDate(nbaDue) }, actor);
    setEditingNba(false);
    setNbaText("");
    setNbaDue("");
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 p-8">
        <Breadcrumb list="Opportunities" onBack={onBack} current={opp.name} />

        <RecordHeader
          icon="◎"
          entity="Opportunity"
          title={opp.name}
          actions={
            <>
              <button
                onClick={handleDelete}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-danger hover:bg-danger-soft transition"
              >
                Delete
              </button>
              <GhostButton onClick={() => setShowAddStakeholder(true)}>+ Stakeholder</GhostButton>
              <GhostButton onClick={() => setShowEdit(true)}>Edit</GhostButton>
              <PrimaryButton onClick={() => setShowLog(true)}>Log Activity</PrimaryButton>
            </>
          }
          highlights={[
            {
              label: "Account",
              value: opp.accountId ? (
                <RecordLink onClick={() => onOpenRecord("account", opp.accountId!)}>{opp.account}</RecordLink>
              ) : (
                opp.account || "—"
              ),
            },
            { label: "Amount", value: formatMoney(opp.amount) },
            { label: "Close Date", value: opp.closeDate ? formatDate(opp.closeDate) : "—" },
            { label: "Owner", value: opp.owner },
            { label: "Stage", value: <StagePill stage={opp.stage} /> },
          ]}
        />

        <StagePath opp={opp} actor={actor} />

        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <div className="flex flex-col gap-4">
            <RecordSection title="Next Best Action">
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
            </RecordSection>

            <RecordSection title="Activity Timeline">
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
            </RecordSection>
          </div>

          <div className="flex flex-col gap-4">
            <RecordSection
              title="Stakeholders"
              action={
                <button onClick={() => setShowAddStakeholder(true)} className="text-sm font-semibold text-gold-deep hover:underline">
                  + Add
                </button>
              }
            >
              <div className="flex flex-col gap-3">
                {opp.contactRoles.length === 0 && <p className="text-sm text-muted">No stakeholders linked yet.</p>}
                {opp.contactRoles.map((r) => {
                  const otherDeals = (oppCountByContact.get(r.contactId) ?? 1) - 1;
                  return (
                    <div key={r.contactId} className="group flex items-center gap-3">
                      <Avatar name={r.name} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-sm">
                          <RecordLink onClick={() => onOpenRecord("contact", r.contactId)}>{r.name}</RecordLink>
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
            </RecordSection>

            <RecordSection title="Details">
              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Created</dt>
                  <dd className="font-medium text-ink">{formatDate(opp.createdAt)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Last Updated</dt>
                  <dd className="font-medium text-ink">{relativeTime(opp.updatedAt)}</dd>
                </div>
                {opp.notes && (
                  <div>
                    <dt className="text-muted">Notes</dt>
                    <dd className="mt-1 text-ink">{opp.notes}</dd>
                  </div>
                )}
              </dl>
            </RecordSection>
          </div>
        </div>
      </div>

      {showLog && <LogActivityModal opp={opp} actor={actor} onClose={() => setShowLog(false)} />}
      {showEdit && (
        <EditOpportunityModal opp={opp} accounts={accounts} owners={owners} actor={actor} onClose={() => setShowEdit(false)} />
      )}
      {showAddStakeholder && (
        <AddStakeholderModal opp={opp} contacts={contacts} actor={actor} onClose={() => setShowAddStakeholder(false)} />
      )}
    </div>
  );
}
