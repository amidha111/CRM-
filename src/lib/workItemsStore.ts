import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentSnapshot,
  type QuerySnapshot,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { db, DEMO, functions, storage } from "../firebase";
import {
  WORK_ITEM_PRIORITY_LABELS,
  WORK_ITEM_PRODUCT_LABELS,
  WORK_ITEM_STATUS_LABELS,
  WORK_ITEM_TYPE_LABELS,
  type Actor,
  type WorkItem,
  type WorkItemContentBlock,
  type WorkItemEvent,
  type WorkItemInput,
  type WorkItemAssignee,
  type WorkItemProduct,
} from "../types";

type Unsub = () => void;

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date();
}

function snapToWorkItem(snap: DocumentSnapshot): WorkItem {
  const data = snap.data({ serverTimestamps: "estimate" })!;
  return {
    id: snap.id,
    sequenceNumber: data.sequenceNumber ?? 0,
    referenceId: data.referenceId ?? snap.id,
    type: data.type ?? "bug",
    product: data.product ?? "plan_clarity",
    subject: data.subject ?? "Untitled work item",
    content: (data.content ?? []) as WorkItemContentBlock[],
    videoUrl: data.videoUrl ?? null,
    priority: data.priority ?? "medium",
    status: data.status ?? "open",
    assigneeEmail: data.assigneeEmail ?? "",
    assigneeName: data.assigneeName ?? "Unassigned",
    createdByEmail: data.createdByEmail ?? "",
    createdByName: data.createdByName ?? "Unknown",
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export async function fetchWorkItemAssignees(): Promise<WorkItemAssignee[]> {
  if (DEMO) return [
    { email: "amidha111@gmail.com", name: "Amit Midha" },
    { email: "rahul@klego.ai", name: "Rahul Panchal" },
  ];
  const result = await httpsCallable<undefined, WorkItemAssignee[]>(functions, "listWorkItemAssignees")();
  return result.data;
}

function snapToEvent(snap: DocumentSnapshot): WorkItemEvent {
  const data = snap.data({ serverTimestamps: "estimate" })!;
  return {
    id: snap.id,
    kind: data.kind ?? "system",
    body: data.body ?? "",
    actorEmail: data.actorEmail ?? "",
    actorName: data.actorName ?? "Unknown",
    createdAt: toDate(data.createdAt),
  };
}

export function subscribeWorkItems(
  callback: (items: WorkItem[]) => void,
  onError: (error: Error) => void,
  product?: WorkItemProduct,
): Unsub {
  if (DEMO) {
    callback([]);
    return () => {};
  }
  const q = product
    ? query(collection(db, "workItems"), where("product", "==", product))
    : query(collection(db, "workItems"), orderBy("updatedAt", "desc"));
  return onSnapshot(q, (snapshot: QuerySnapshot) => {
    const items = snapshot.docs.map(snapToWorkItem).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    callback(items);
  }, onError);
}

export function subscribeWorkItemEvents(
  workItemId: string,
  callback: (events: WorkItemEvent[]) => void,
  onError: (error: Error) => void,
): Unsub {
  if (DEMO) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, "workItems", workItemId, "events"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snapshot: QuerySnapshot) => callback(snapshot.docs.map(snapToEvent)), onError);
}

export function newWorkItemId(): string {
  return doc(collection(db, "workItems")).id;
}

function eventData(kind: WorkItemEvent["kind"], body: string, actor: Actor, actorEmail: string) {
  return {
    kind,
    body,
    actorEmail,
    actorName: actor.name,
    createdAt: serverTimestamp(),
  };
}

export async function createWorkItem(
  id: string,
  input: WorkItemInput,
): Promise<void> {
  if (DEMO) return;
  const create = httpsCallable(functions, "createWorkItemRecord");
  await create({ id, input });
}

function changeSummary(before: WorkItem, after: WorkItemInput): string {
  const changes: string[] = [];
  if (before.status !== after.status) {
    changes.push(`status from ${WORK_ITEM_STATUS_LABELS[before.status]} to ${WORK_ITEM_STATUS_LABELS[after.status]}`);
  }
  if (before.assigneeEmail !== after.assigneeEmail) {
    changes.push(`assignee from ${before.assigneeName} to ${after.assigneeName}`);
  }
  if (before.priority !== after.priority) {
    changes.push(`priority from ${WORK_ITEM_PRIORITY_LABELS[before.priority]} to ${WORK_ITEM_PRIORITY_LABELS[after.priority]}`);
  }
  if (before.product !== after.product) {
    changes.push(`product from ${WORK_ITEM_PRODUCT_LABELS[before.product]} to ${WORK_ITEM_PRODUCT_LABELS[after.product]}`);
  }
  if (before.type !== after.type) {
    changes.push(`type from ${WORK_ITEM_TYPE_LABELS[before.type]} to ${WORK_ITEM_TYPE_LABELS[after.type]}`);
  }
  if (before.videoUrl !== after.videoUrl) changes.push("walkthrough video");
  if (before.subject !== after.subject || JSON.stringify(before.content) !== JSON.stringify(after.content)) {
    changes.push("description");
  }
  return changes.length ? `Updated ${changes.join(", ")}.` : "Updated this work item.";
}

export async function updateWorkItem(
  before: WorkItem,
  input: WorkItemInput,
  actor: Actor,
  actorEmail: string,
): Promise<void> {
  if (DEMO) return;
  const batch = writeBatch(db);
  batch.update(doc(db, "workItems", before.id), { ...input, updatedAt: serverTimestamp() });
  const eventRef = doc(collection(db, "workItems", before.id, "events"));
  batch.set(eventRef, eventData("system", changeSummary(before, input), actor, actorEmail));
  await batch.commit();
}

export async function addWorkItemComment(
  workItemId: string,
  body: string,
  actor: Actor,
  actorEmail: string,
): Promise<void> {
  if (DEMO) return;
  const clean = body.trim();
  if (!clean) throw new Error("Write a comment first.");
  await setDoc(
    doc(collection(db, "workItems", workItemId, "events")),
    eventData("comment", clean, actor, actorEmail),
  );
  await updateDoc(doc(db, "workItems", workItemId), { updatedAt: serverTimestamp() });
}

export async function uploadWorkItemImage(
  workItemId: string,
  blockId: string,
  file: File,
): Promise<Extract<WorkItemContentBlock, { type: "image" }>> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name || "Clipboard item"} is not an image.`);
  if (file.size > 10 * 1024 * 1024) throw new Error("Images must be smaller than 10 MB.");
  const safeName = (file.name || "pasted-image.png").replace(/[^a-zA-Z0-9._-]+/g, "-");
  const storagePath = `workItems/${workItemId}/${blockId}-${safeName}`;
  if (!DEMO) {
    await uploadBytes(ref(storage, storagePath), file, { contentType: file.type });
  }
  return { id: blockId, type: "image", storagePath, name: file.name || "Pasted image" };
}

export async function resolveWorkItemImageUrl(storagePath: string): Promise<string> {
  if (DEMO) return "";
  return getDownloadURL(ref(storage, storagePath));
}
