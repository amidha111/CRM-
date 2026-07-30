import { useState, type FormEvent } from "react";
import type { Actor, WorkItem, WorkItemAssignee, WorkItemProduct, WorkItemStatus } from "../types";
import { WORK_ITEM_PRODUCT_LABELS } from "../types";
import { Breadcrumb, RecordHeader, RecordSection } from "../components/record";
import { PIcon } from "../components/icons";
import { Avatar, PrimaryButton, inputCls } from "../components/ui";
import { WorkItemContent, videoEmbedUrl } from "../components/workItemContent";
import { WorkItemModal } from "../components/workItemModal";
import { WorkItemBadge } from "./WorkItems";
import { useWorkItemEvents } from "../lib/workItemHooks";
import { addWorkItemComment, updateWorkItem } from "../lib/workItemsStore";
import { formatDate, relativeTime } from "../lib/format";

export function WorkItemRecordPage({ item, actor, actorEmail, onBack, allowedProducts = ["klego", "plan_clarity"], assignees }: { item: WorkItem; actor: Actor; actorEmail: string; onBack: () => void; allowedProducts?: WorkItemProduct[]; assignees: WorkItemAssignee[] }) {
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [assigneeBusy, setAssigneeBusy] = useState(false);
  const [assigneeError, setAssigneeError] = useState<string | null>(null);
  const { events, error: eventsError } = useWorkItemEvents(item.id);
  const embedUrl = videoEmbedUrl(item.videoUrl);

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null);
    try { await addWorkItemComment(item.id, comment, actor, actorEmail); setComment(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to add comment."); }
    finally { setBusy(false); }
  }

  async function changeStatus(status: WorkItemStatus) {
    if (status === item.status) return;
    setStatusBusy(true);
    setStatusError(null);
    try {
      await updateWorkItem(item, {
        type: item.type,
        product: item.product,
        subject: item.subject,
        content: item.content,
        videoUrl: item.videoUrl,
        priority: item.priority,
        status,
        assigneeEmail: item.assigneeEmail,
        assigneeName: item.assigneeName,
      }, actor, actorEmail);
    } catch (reason) {
      setStatusError(reason instanceof Error ? reason.message : "Unable to change this status.");
    } finally {
      setStatusBusy(false);
    }
  }

  async function changeAssignee(email: string) {
    if (email === item.assigneeEmail) return;
    const assignee = assignees.find((person) => person.email === email);
    if (!assignee) return;
    setAssigneeBusy(true);
    setAssigneeError(null);
    try {
      await updateWorkItem(item, {
        type: item.type,
        product: item.product,
        subject: item.subject,
        content: item.content,
        videoUrl: item.videoUrl,
        priority: item.priority,
        status: item.status,
        assigneeEmail: assignee.email,
        assigneeName: assignee.name,
      }, actor, actorEmail);
    } catch (reason) {
      setAssigneeError(reason instanceof Error ? reason.message : "Unable to reassign this work item.");
    } finally {
      setAssigneeBusy(false);
    }
  }

  return <main className="page-frame min-w-0">
    <div className="mb-3"><Breadcrumb list="Work Items" onBack={onBack} current={`${item.referenceId} · ${item.subject}`} /></div>
    <RecordHeader icon="note" entity="Work Item" reference={item.referenceId} title={item.subject} actions={<>
      <label className="flex items-center gap-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted">Assigned to</span>
        <select
          className={`${inputCls} h-9 w-auto min-w-36 py-1.5 font-semibold`}
          value={item.assigneeEmail}
          disabled={assigneeBusy || statusBusy}
          onChange={(event) => void changeAssignee(event.target.value)}
          aria-label="Change Work Item assignee"
        >
          {assignees.map((person) => <option key={person.email} value={person.email}>{person.name}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted">Status</span>
        <select
          className={`${inputCls} h-9 w-auto min-w-40 py-1.5 font-semibold`}
          value={item.status}
          disabled={statusBusy || assigneeBusy}
          onChange={(event) => void changeStatus(event.target.value as WorkItemStatus)}
          aria-label="Change Work Item status"
        >
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="ready_for_review">Ready for Review</option>
          <option value="closed">Resolved</option>
        </select>
      </label>
      <button type="button" className="toolbar-button" onClick={() => setEditing(true)}><PIcon name="edit" size={15} />Edit</button>
    </>} highlights={[
      { label: "Type", value: <WorkItemBadge value={item.type} kind="type" /> },
      { label: "Product", value: WORK_ITEM_PRODUCT_LABELS[item.product] },
      { label: "Priority", value: <WorkItemBadge value={item.priority} kind="priority" /> },
      { label: "Status", value: <WorkItemBadge value={item.status} kind="status" /> },
    ]} />
    {(statusError || assigneeError) && <p className="mt-3 rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">{statusError || assigneeError}</p>}
    <div className="relative z-0 mt-4 grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <RecordSection title="Details"><WorkItemContent content={item.content} /></RecordSection>
        <RecordSection title="Issue Explained">
          {item.videoUrl ? <div className="flex flex-col gap-3">
            {embedUrl && <div className="aspect-video overflow-hidden rounded-lg border border-line bg-navy"><iframe className="h-full w-full" src={embedUrl} title="Issue walkthrough video" allow="fullscreen; picture-in-picture" allowFullScreen /></div>}
            <a className="inline-flex items-center gap-2 self-start font-semibold text-gold-deep hover:underline" href={item.videoUrl} target="_blank" rel="noreferrer">Open walkthrough video <PIcon name="chevronRight" size={14} /></a>
          </div> : <p className="text-sm text-muted">No walkthrough video has been added.</p>}
        </RecordSection>
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <RecordSection title="Assignment">
          <div className="flex items-center gap-3"><Avatar name={item.assigneeName} size={34} /><div><p className="font-semibold text-ink">{item.assigneeName}</p><p className="text-xs text-muted">{item.assigneeEmail}</p></div></div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted">Created by</dt><dd className="font-semibold">{item.createdByName}</dd></div><div><dt className="text-muted">Created</dt><dd className="font-semibold">{formatDate(item.createdAt)}</dd></div></dl>
        </RecordSection>
        <RecordSection title="Timeline">
          <form onSubmit={submitComment} className="mb-5 flex flex-col gap-2">
            <textarea className={`${inputCls} min-h-24 resize-y`} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a comment for the team…" />
            {(error || eventsError) && <p className="text-xs text-danger">{error || eventsError?.message}</p>}
            <PrimaryButton type="submit" disabled={busy || !comment.trim()}>{busy ? "Posting…" : "Add Comment"}</PrimaryButton>
          </form>
          {!events ? <p className="text-sm text-muted">Loading timeline…</p> : <div className="flex flex-col gap-4">{events.map((entry) => <div key={entry.id} className="flex gap-3">
            <Avatar name={entry.actorName} size={28} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-2"><span className="text-sm font-semibold">{entry.actorName}</span><span className="text-[11px] text-faint">{relativeTime(entry.createdAt)}</span>{entry.kind === "system" && <span className="rounded bg-tone px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted">System</span>}</div><p className={`mt-1 whitespace-pre-wrap text-sm leading-5 ${entry.kind === "system" ? "text-muted" : "text-ink"}`}>{entry.body}</p></div>
          </div>)}{events.length === 0 && <p className="text-sm text-muted">No timeline entries yet.</p>}</div>}
        </RecordSection>
      </div>
    </div>
    {editing && <WorkItemModal item={item} actor={actor} actorEmail={actorEmail} allowedProducts={allowedProducts} assignees={assignees} onClose={() => setEditing(false)} />}
  </main>;
}
