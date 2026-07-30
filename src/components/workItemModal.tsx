import { useState, type FormEvent } from "react";
import type {
  Actor,
  WorkItem,
  WorkItemInput,
  WorkItemPriority,
  WorkItemProduct,
  WorkItemStatus,
  WorkItemType,
} from "../types";
import { createWorkItem, newWorkItemId, updateWorkItem } from "../lib/workItemsStore";
import {
  draftContent,
  saveDraftContent,
  WorkItemDetailsEditor,
  type DraftWorkItemContentBlock,
} from "./workItemContent";
import { Field, GhostButton, inputCls, Modal, PrimaryButton } from "./ui";
import { WORK_ITEM_ASSIGNEES, workItemAssignee } from "../lib/workItemAssignees";

export function WorkItemModal({
  item,
  actor,
  actorEmail,
  onClose,
  allowedProducts = ["klego", "plan_clarity"],
}: {
  item?: WorkItem;
  actor: Actor;
  actorEmail: string;
  onClose: () => void;
  allowedProducts?: WorkItemProduct[];
}) {
  const [type, setType] = useState<WorkItemType>(item?.type ?? "bug");
  const [product, setProduct] = useState<WorkItemProduct>(item?.product ?? allowedProducts[0] ?? "plan_clarity");
  const [subject, setSubject] = useState(item?.subject ?? "");
  const [content, setContent] = useState<DraftWorkItemContentBlock[]>(draftContent(item?.content));
  const [videoUrl, setVideoUrl] = useState(item?.videoUrl ?? "");
  const [priority, setPriority] = useState<WorkItemPriority>(item?.priority ?? "medium");
  const [status, setStatus] = useState<WorkItemStatus>(item?.status ?? "open");
  const [assigneeEmail, setAssigneeEmail] = useState(item?.assigneeEmail ?? "amidha111@gmail.com");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!subject.trim()) return setError("Add a subject.");
    if (!content.some((block) => block.type === "image" || block.text.trim())) {
      return setError("Add some details or paste a screenshot.");
    }
    if (videoUrl.trim()) {
      try {
        const url = new URL(videoUrl.trim());
        if (!/^https?:$/.test(url.protocol)) throw new Error();
      } catch {
        return setError("Use a full video link beginning with http:// or https://.");
      }
    }

    setBusy(true);
    try {
      const id = item?.id ?? newWorkItemId();
      const savedContent = await saveDraftContent(id, content);
      const assignee = workItemAssignee(assigneeEmail);
      const input: WorkItemInput = {
        type,
        product,
        subject: subject.trim(),
        content: savedContent,
        videoUrl: videoUrl.trim() || null,
        priority,
        status,
        assigneeEmail: assignee.email,
        assigneeName: assignee.name,
      };
      if (item) await updateWorkItem(item, input, actor, actorEmail);
      else await createWorkItem(id, input, actor, actorEmail);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save this work item.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={item ? "Edit Work Item" : "New Work Item"}
      subtitle="Track a bug or feature from first report through completion."
      onClose={onClose}
      width={780}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" required>
            <select className={inputCls} value={type} onChange={(event) => setType(event.target.value as WorkItemType)}>
              <option value="bug">Bug</option>
              <option value="feature">Feature</option>
            </select>
          </Field>
          <Field label="Product" required>
            <select className={inputCls} value={product} onChange={(event) => setProduct(event.target.value as WorkItemProduct)}>
              {allowedProducts.includes("klego") && <option value="klego">Klego</option>}
              {allowedProducts.includes("plan_clarity") && <option value="plan_clarity">Plan Clarity</option>}
            </select>
          </Field>
        </div>
        <Field label="Subject" required>
          <input className={inputCls} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Short summary of the bug or feature" />
        </Field>
        <Field label="Details and screenshots" required>
          <WorkItemDetailsEditor blocks={content} onChange={setContent} />
        </Field>
        <Field label="Issue explained (video URL)">
          <input className={inputCls} type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://www.loom.com/share/..." />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Priority" required>
            <select className={inputCls} value={priority} onChange={(event) => setPriority(event.target.value as WorkItemPriority)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>
          <Field label="Assigned to" required>
            <select className={inputCls} value={assigneeEmail} onChange={(event) => setAssigneeEmail(event.target.value)}>
              {WORK_ITEM_ASSIGNEES.map((person) => <option key={person.email} value={person.email}>{person.name}</option>)}
            </select>
          </Field>
          <Field label="Status" required>
            <select className={inputCls} value={status} onChange={(event) => setStatus(event.target.value as WorkItemStatus)}>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="ready_for_review">Ready for Review</option>
              <option value="closed">Resolved</option>
            </select>
          </Field>
        </div>
        {error && <p className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={busy}>{busy ? "Saving…" : item ? "Save Changes" : "Create Work Item"}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
