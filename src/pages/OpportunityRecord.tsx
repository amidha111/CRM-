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
import { AddStakeholderModal, EditOpportunityModal, LogActivityModal, MeetTranscriptModal } from "../components/modals";
import { PIcon, type IconName } from "../components/icons";

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 12);
}

const TYPE_ICONS: Record<string, IconName> = {
  created: "star",
  action_completed: "checkCircle",
  action_set: "zap",
  stage_change: "trend",
  stakeholder_added: "plus",
  stakeholder_removed: "x",
  call: "phone",
  email: "mail",
  meeting: "users",
  note: "note",
};

/** SF Lightning-style sales path: chevron per stage, click to move the deal. */
function StagePath({ opp, actor }: { opp: Opportunity; actor: Actor }) {
  const currentIdx = STAGES.indexOf(opp.stage);
  return (
    <div className="card flex items-center gap-2 overflow-x-auto p-2.5">
      <div className="flex min-w-[760px] flex-1 gap-[3px]">
        {STAGES.map((s, i) => {
          const active = s === opp.stage;
          const done = i < currentIdx && opp.stage !== "closed_lost";
          const tone = active
            ? "bg-[linear-gradient(180deg,#f6d684,#ecbe4e)] text-navy shadow-[inset_0_-1.5px_0_rgb(0_0_0/0.12)]"
            : done
              ? "bg-navy-soft text-white/85"
              : "bg-tone text-muted hover:bg-gold-soft/60";
          return (
            <button
              key={s}
              onClick={() => changeStage(opp, s as Stage, actor)}
              title={`Move to ${STAGE_LABELS[s]}`}
              className={`flex h-9 min-w-28 flex-1 items-center justify-center gap-1.5 px-4 text-xs font-semibold transition ${tone}`}
              style={{
                clipPath:
                  i === STAGES.length - 1
                    ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%)"
                    : i === 0
                      ? "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)"
                      : "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)",
                borderRadius: i === 0 ? "8px 0 0 8px" : i === STAGES.length - 1 ? "0 8px 8px 0" : undefined,
              }}
            >
              {done && <PIcon name="check" size={13} sw={2.4} />}
              {STAGE_LABELS[s]}
            </button>
          );
        })}
      </div>
      <button type="button" className="hidden h-[34px] items-center gap-2 rounded-lg bg-navy-soft px-3 text-xs font-semibold text-white xl:inline-flex">
        <PIcon name="checkCircle" size={14} />
        Mark Stage Complete
      </button>
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
  const [showMeetTranscript, setShowMeetTranscript] = useState(false);
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
    <div className="page-frame">
      <div className="flex flex-col gap-4">
        <Breadcrumb list="Opportunities" onBack={onBack} current={opp.name} />

        <RecordHeader
          icon="◎"
          entity="Opportunity"
          title={opp.name}
          actions={
            <>
              <button
                onClick={handleDelete}
                className="rounded-md px-3 py-2 text-sm font-semibold text-danger hover:bg-danger-soft transition"
              >
                Delete
              </button>
              <GhostButton onClick={() => setShowAddStakeholder(true)}>+ Stakeholder</GhostButton>
              <GhostButton onClick={() => setShowMeetTranscript(true)}>Meet Notes</GhostButton>
              <GhostButton onClick={() => setShowEdit(true)}>
                <PIcon name="edit" size={14} />
                Edit
              </GhostButton>
              <PrimaryButton onClick={() => setShowLog(true)}>
                <PIcon name="phone" size={14} />
                Log Activity
              </PrimaryButton>
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
          ]}
        />

        <StagePath opp={opp} actor={actor} />

        <div className="grid gap-4 xl:grid-cols-[350px_1fr_330px]">
          <RecordSection
            title="Details"
            action={
              <button onClick={() => setShowEdit(true)} className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink">
                <PIcon name="edit" size={13} />
                Edit
              </button>
            }
          >
            <dl className="flex flex-col text-sm">
              {[
                ["Stage", <StagePill stage={opp.stage} />],
                ["Amount", <b>{formatMoney(opp.amount)}</b>],
                ["Close Date", opp.closeDate ? formatDate(opp.closeDate) : "—"],
                ["Created", formatDate(opp.createdAt)],
                ["Last Updated", relativeTime(opp.updatedAt)],
              ].map(([label, value]) => (
                <div key={String(label)} className="border-b border-line-soft py-2.5 last:border-0">
                  <dt className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</dt>
                  <dd className="mt-1 flex items-center gap-2 font-medium text-ink">{value}</dd>
                </div>
              ))}
              {opp.notes && (
                <div className="pt-2.5">
                  <dt className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">Notes</dt>
                  <dd className="mt-2 rounded-lg border border-line-soft bg-tone px-3 py-2 text-sm leading-relaxed text-muted">
                    {opp.notes}
                  </dd>
                </div>
              )}
            </dl>
          </RecordSection>

          <div className="panel">
            <div className="panel-top">
              <PIcon name="activity" size={15} />
              <h2>Activity</h2>
              <span className="panel-count">{timeline.length} EVENTS</span>
              <button onClick={() => setShowLog(true)} className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink">
                <PIcon name="plus" size={13} />
                Log
              </button>
            </div>
            <div className="flex gap-1 px-[18px] pt-3">
              {[
                ["phone", "Call"],
                ["mail", "Email"],
                ["users", "Meeting"],
                ["note", "Note"],
              ].map(([icon, label], i) => (
                <button
                  key={label}
                  onClick={() => setShowLog(true)}
                  className={`flex h-8 items-center gap-1.5 rounded-t-lg border px-3 text-xs font-semibold ${
                    i === 0 ? "border-line border-b-transparent bg-tone text-ink" : "border-transparent text-muted"
                  }`}
                >
                  <PIcon name={icon as IconName} size={13} />
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowLog(true)}
              className="mx-[18px] mt-0 block w-[calc(100%-36px)] rounded-[0_10px_10px_10px] border border-line bg-tone px-3.5 py-3 text-left text-sm text-faint"
            >
              Log a call, email, meeting, or note...
            </button>
            <div className="flex flex-col px-[18px] py-4">
              {opp.nextAction && (
                <>
                  <div className="py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Upcoming &amp; Overdue</div>
                  <div className="relative flex gap-3 pb-4">
                    <span className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold-soft text-gold-deep">
                      <PIcon name="zap" size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-ink">{opp.nextAction.text}</span>
                        <span className="ml-auto"><DueBadge due={opp.nextAction.dueDate} /></span>
                      </div>
                      <div className="mt-1 text-xs text-muted">Next step · set by {actor.name}</div>
                    </div>
                  </div>
                </>
              )}
              <div className="py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Timeline</div>
              {timeline.length === 0 && <p className="text-sm text-muted">Nothing logged yet.</p>}
              {timeline.map((a) => (
                <div key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                  <span className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-full border border-line bg-tone text-muted">
                    <PIcon name={TYPE_ICONS[a.type] ?? "note"} size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-ink">{a.detail}</span>
                      <span className="ml-auto whitespace-nowrap font-mono text-[10.5px] text-faint">
                        {a.actor} · {relativeTime(a.createdAt)}
                      </span>
                    </div>
                    {a.note && <p className="mt-2 rounded-lg border border-line-soft bg-tone px-3 py-2 text-xs leading-relaxed text-muted">{a.note}</p>}
                    {a.link && (
                      <a href={a.link} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-gold-deep underline">
                        {a.link}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-gold/50 bg-[linear-gradient(170deg,#fdf6e0,#faf0d6)] p-4 shadow-[0_1px_2px_rgb(22_33_58/0.05),0_4px_14px_rgb(22_33_58/0.05)]">
              <div className="flex items-center gap-2">
                <PIcon name="zap" size={14} className="text-gold-deep" />
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold-deep">Next Best Action</span>
              </div>
              {closed ? (
                <p className="mt-3 text-sm text-muted">Deal is closed — no next action.</p>
              ) : editingNba || !opp.nextAction ? (
                <div className="mt-3 flex flex-col gap-3">
                  <Field label="Action">
                    <input className={inputCls} placeholder="e.g., Send revised SOW" value={nbaText} onChange={(e) => setNbaText(e.target.value)} />
                  </Field>
                  <Field label="Due">
                    <input className={inputCls} type="date" value={nbaDue} onChange={(e) => setNbaDue(e.target.value)} />
                  </Field>
                  <div className="flex gap-2">
                    <PrimaryButton onClick={saveNba} disabled={!nbaText.trim() || !nbaDue}>Save action</PrimaryButton>
                    {opp.nextAction && <GhostButton onClick={() => setEditingNba(false)}>Cancel</GhostButton>}
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-2 text-[15px] font-bold text-ink">{opp.nextAction.text}</div>
                  <div className="mt-2"><DueBadge due={opp.nextAction.dueDate} /></div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => completeNextAction(opp, null, actor)}
                      className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-navy-soft text-xs font-semibold text-white"
                    >
                      <PIcon name="check" size={13} sw={2.2} />
                      Mark done
                    </button>
                    <button
                      onClick={() => {
                        setNbaText(opp.nextAction!.text);
                        setEditingNba(true);
                      }}
                      className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-gold/50 bg-white/70 px-3 text-xs font-semibold text-gold-deep"
                    >
                      <PIcon name="calendar" size={13} />
                      Reschedule
                    </button>
                  </div>
                </>
              )}
            </div>

            <RecordSection
              title="Stakeholders"
              action={<span className="panel-count">{opp.contactRoles.length}</span>}
            >
              <div className="flex flex-col">
                {opp.contactRoles.length === 0 && <p className="text-sm text-muted">No stakeholders linked yet.</p>}
                {opp.contactRoles.map((r) => {
                  const otherDeals = (oppCountByContact.get(r.contactId) ?? 1) - 1;
                  return (
                    <div key={r.contactId} className="group flex items-center gap-3 border-b border-line-soft py-3 last:border-0">
                      <Avatar name={r.name} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-sm">
                          <RecordLink onClick={() => onOpenRecord("contact", r.contactId)}>{r.name}</RecordLink>
                          {r.isPrimary && <PIcon name="star" size={11} className="text-gold" />}
                        </p>
                        <p className="text-xs text-muted">
                          {ROLE_LABELS[r.role]}
                          {otherDeals > 0 ? ` · ${otherDeals} other deal${otherDeals > 1 ? "s" : ""}` : ""}
                        </p>
                      </div>
                      <button onClick={() => removeStakeholder(opp, r.contactId, actor)} title="Remove from deal" className="invisible text-muted hover:text-danger group-hover:visible">
                        ×
                      </button>
                    </div>
                  );
                })}
                <button onClick={() => setShowAddStakeholder(true)} className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink">
                  <PIcon name="plus" size={13} sw={2.2} />
                  Add stakeholder
                </button>
              </div>
            </RecordSection>
          </div>
        </div>
      </div>

      {showLog && <LogActivityModal opp={opp} actor={actor} onClose={() => setShowLog(false)} />}
      {showMeetTranscript && (
        <MeetTranscriptModal opp={opp} actor={actor} onClose={() => setShowMeetTranscript(false)} />
      )}
      {showEdit && (
        <EditOpportunityModal opp={opp} accounts={accounts} owners={owners} actor={actor} onClose={() => setShowEdit(false)} />
      )}
      {showAddStakeholder && (
        <AddStakeholderModal opp={opp} contacts={contacts} actor={actor} onClose={() => setShowAddStakeholder(false)} />
      )}
    </div>
  );
}
