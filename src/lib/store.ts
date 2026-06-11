import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  limit,
  writeBatch,
  serverTimestamp,
  type DocumentSnapshot,
  type QuerySnapshot,
} from "firebase/firestore";
import { db, DEMO } from "../firebase";
import {
  ROLE_LABELS,
  STAGE_LABELS,
  type Account,
  type AccountRefInput,
  type Activity,
  type ActivityType,
  type Actor,
  type Contact,
  type ContactRole,
  type NewAccountInput,
  type NewContactInput,
  type NewOpportunityInput,
  type Opportunity,
  type Stage,
  type StakeholderInput,
} from "../types";
import * as demo from "./demoStore";

type Unsub = () => void;

// ---------- converters ----------

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  return new Date();
}

function snapToOpp(snap: DocumentSnapshot): Opportunity {
  const d = snap.data({ serverTimestamps: "estimate" })!;
  return {
    id: snap.id,
    name: d.name,
    accountId: d.accountId ?? null,
    account: d.accountName ?? d.account ?? "", // legacy docs stored a plain `account` string
    owner: d.owner,
    amount: d.amount,
    stage: d.stage,
    closeDate: toDate(d.closeDate),
    notes: d.notes ?? "",
    nextAction: d.nextAction
      ? {
          text: d.nextAction.text,
          dueDate: toDate(d.nextAction.dueDate),
          createdAt: toDate(d.nextAction.createdAt),
        }
      : null,
    contactRoles: (d.contactRoles ?? []) as ContactRole[],
    contactIds: (d.contactIds ?? []) as string[],
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

function snapToActivity(snap: DocumentSnapshot): Activity {
  const d = snap.data({ serverTimestamps: "estimate" })!;
  return {
    id: snap.id,
    oppId: d.oppId,
    oppName: d.oppName,
    account: d.account,
    type: d.type,
    detail: d.detail,
    note: d.note ?? null,
    link: d.link ?? null,
    fromStage: d.fromStage ?? null,
    toStage: d.toStage ?? null,
    contactId: d.contactId ?? null,
    actor: d.actor,
    actorUid: d.actorUid,
    createdAt: toDate(d.createdAt),
  };
}

function snapToContact(snap: DocumentSnapshot): Contact {
  const d = snap.data({ serverTimestamps: "estimate" })!;
  return {
    id: snap.id,
    name: d.name,
    accountId: d.accountId ?? null,
    accountName: d.accountName ?? d.company ?? "", // `company` was the pre-accounts field
    title: d.title ?? null,
    email: d.email ?? null,
    phone: d.phone ?? null,
    notes: d.notes ?? "",
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

function snapToAccount(snap: DocumentSnapshot): Account {
  const d = snap.data({ serverTimestamps: "estimate" })!;
  return {
    id: snap.id,
    name: d.name,
    industry: d.industry ?? null,
    website: d.website ?? null,
    phone: d.phone ?? null,
    notes: d.notes ?? "",
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

// ---------- subscriptions ----------

export function subscribeOpportunities(
  cb: (opps: Opportunity[]) => void,
  onError: (e: Error) => void,
): Unsub {
  if (DEMO) return demo.subscribeOpportunities(cb);
  const q = query(collection(db, "opportunities"), orderBy("updatedAt", "desc"));
  return onSnapshot(
    q,
    (qs: QuerySnapshot) => cb(qs.docs.map(snapToOpp)),
    onError,
  );
}

export function subscribeActivities(
  cb: (acts: Activity[]) => void,
  onError: (e: Error) => void,
): Unsub {
  if (DEMO) return demo.subscribeActivities(cb);
  const q = query(collection(db, "activities"), orderBy("createdAt", "desc"), limit(300));
  return onSnapshot(
    q,
    (qs: QuerySnapshot) => cb(qs.docs.map(snapToActivity)),
    onError,
  );
}

export function subscribeContacts(
  cb: (contacts: Contact[]) => void,
  onError: (e: Error) => void,
): Unsub {
  if (DEMO) return demo.subscribeContacts(cb);
  const q = query(collection(db, "contacts"), orderBy("name"));
  return onSnapshot(
    q,
    (qs: QuerySnapshot) => cb(qs.docs.map(snapToContact)),
    onError,
  );
}

export function subscribeAccounts(
  cb: (accounts: Account[]) => void,
  onError: (e: Error) => void,
): Unsub {
  if (DEMO) return demo.subscribeAccounts(cb);
  const q = query(collection(db, "accounts"), orderBy("name"));
  return onSnapshot(
    q,
    (qs: QuerySnapshot) => cb(qs.docs.map(snapToAccount)),
    onError,
  );
}

// ---------- mutation helpers ----------

function activityDoc(
  opp: { id: string; name: string; account: string },
  actor: Actor,
  type: ActivityType,
  detail: string,
  extra?: Partial<Pick<Activity, "note" | "link" | "fromStage" | "toStage" | "contactId">>,
) {
  return {
    oppId: opp.id,
    oppName: opp.name,
    account: opp.account,
    type,
    detail,
    note: extra?.note ?? null,
    link: extra?.link ?? null,
    fromStage: extra?.fromStage ?? null,
    toStage: extra?.toStage ?? null,
    contactId: extra?.contactId ?? null,
    actor: actor.name,
    actorUid: actor.uid,
    createdAt: serverTimestamp(),
  };
}

function newActivityRef() {
  return doc(collection(db, "activities"));
}

/** Resolve an AccountRefInput to an id+name, creating the account in the batch if new. */
function resolveAccount(
  batch: ReturnType<typeof writeBatch>,
  input: AccountRefInput,
): { accountId: string; accountName: string } {
  if (input.accountId) return { accountId: input.accountId, accountName: input.name };
  const ref = doc(collection(db, "accounts"));
  batch.set(ref, {
    name: input.name,
    industry: null,
    website: null,
    phone: null,
    notes: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { accountId: ref.id, accountName: input.name };
}

/**
 * Resolve a StakeholderInput to a contactId, creating the contact in the batch
 * if new. New contacts inherit the deal's account (SF: Contact.AccountId).
 */
function resolveContact(
  batch: ReturnType<typeof writeBatch>,
  input: StakeholderInput,
  account: { accountId: string | null; accountName: string },
): string {
  if (input.contactId) return input.contactId;
  const ref = doc(collection(db, "contacts"));
  batch.set(ref, {
    name: input.name,
    accountId: account.accountId,
    accountName: account.accountName,
    title: ("title" in input && input.title) || null,
    email: ("email" in input && input.email) || null,
    phone: null,
    notes: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// ---------- mutations ----------

export async function createOpportunity(input: NewOpportunityInput, actor: Actor): Promise<string> {
  if (DEMO) return demo.createOpportunity(input, actor);
  const batch = writeBatch(db);
  const account = resolveAccount(batch, input.account);
  const contactId = resolveContact(batch, input.stakeholder, account);
  const oppRef = doc(collection(db, "opportunities"));
  const role: ContactRole = {
    contactId,
    name: input.stakeholder.name,
    role: input.stakeholder.role,
    isPrimary: true,
  };
  batch.set(oppRef, {
    name: input.name,
    accountId: account.accountId,
    accountName: account.accountName,
    owner: input.owner,
    amount: input.amount,
    stage: input.stage,
    closeDate: input.closeDate,
    notes: "",
    nextAction: {
      text: input.firstAction.text,
      dueDate: input.firstAction.dueDate,
      createdAt: new Date(),
    },
    contactRoles: [role],
    contactIds: [contactId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const oppRef2 = { id: oppRef.id, name: input.name, account: account.accountName };
  batch.set(newActivityRef(), activityDoc(oppRef2, actor, "created", `Created opportunity "${input.name}" for ${account.accountName}`));
  batch.set(
    newActivityRef(),
    activityDoc(oppRef2, actor, "action_set", `Set next action "${input.firstAction.text}"`),
  );
  await batch.commit();
  return oppRef.id;
}

export async function completeNextAction(
  opp: Opportunity,
  next: { text: string; dueDate: Date } | null,
  actor: Actor,
): Promise<void> {
  if (DEMO) return demo.completeNextAction(opp, next, actor);
  if (!opp.nextAction) return;
  const batch = writeBatch(db);
  batch.set(
    newActivityRef(),
    activityDoc(opp, actor, "action_completed", `Completed "${opp.nextAction.text}"`),
  );
  if (next) {
    batch.set(newActivityRef(), activityDoc(opp, actor, "action_set", `Set next action "${next.text}"`));
  }
  batch.update(doc(db, "opportunities", opp.id), {
    nextAction: next ? { text: next.text, dueDate: next.dueDate, createdAt: new Date() } : null,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function setNextAction(
  opp: Opportunity,
  next: { text: string; dueDate: Date },
  actor: Actor,
): Promise<void> {
  if (DEMO) return demo.setNextAction(opp, next, actor);
  const batch = writeBatch(db);
  batch.set(newActivityRef(), activityDoc(opp, actor, "action_set", `Set next action "${next.text}"`));
  batch.update(doc(db, "opportunities", opp.id), {
    nextAction: { text: next.text, dueDate: next.dueDate, createdAt: new Date() },
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function changeStage(opp: Opportunity, toStage: Stage, actor: Actor): Promise<void> {
  if (DEMO) return demo.changeStage(opp, toStage, actor);
  if (opp.stage === toStage) return;
  const closed = toStage === "closed_won" || toStage === "closed_lost";
  const batch = writeBatch(db);
  batch.set(
    newActivityRef(),
    activityDoc(
      opp,
      actor,
      "stage_change",
      `Moved from ${STAGE_LABELS[opp.stage]} to ${STAGE_LABELS[toStage]}`,
      { fromStage: opp.stage, toStage },
    ),
  );
  batch.update(doc(db, "opportunities", opp.id), {
    stage: toStage,
    ...(closed ? { nextAction: null } : {}),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function logTouch(
  opp: Opportunity,
  type: "call" | "email" | "meeting" | "note",
  note: string,
  link: string | null,
  newAction: { text: string; dueDate: Date } | null,
  actor: Actor,
): Promise<void> {
  if (DEMO) return demo.logTouch(opp, type, note, link, newAction, actor);
  const labels = { call: "Call", email: "Email", meeting: "Meeting", note: "Note" };
  const batch = writeBatch(db);
  batch.set(newActivityRef(), activityDoc(opp, actor, type, `${labels[type]} logged`, { note, link }));
  if (newAction) {
    batch.set(
      newActivityRef(),
      activityDoc(opp, actor, "action_set", `Set next action "${newAction.text}"`),
    );
  }
  batch.update(doc(db, "opportunities", opp.id), {
    ...(newAction
      ? { nextAction: { text: newAction.text, dueDate: newAction.dueDate, createdAt: new Date() } }
      : {}),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function addStakeholder(
  opp: Opportunity,
  input: StakeholderInput,
  actor: Actor,
): Promise<void> {
  if (DEMO) return demo.addStakeholder(opp, input, actor);
  const batch = writeBatch(db);
  const contactId = resolveContact(batch, input, { accountId: opp.accountId, accountName: opp.account });
  if (opp.contactIds.includes(contactId)) return;
  let roles = opp.contactRoles.map((r) =>
    input.isPrimary ? { ...r, isPrimary: false } : r,
  );
  roles = [...roles, { contactId, name: input.name, role: input.role, isPrimary: input.isPrimary }];
  batch.update(doc(db, "opportunities", opp.id), {
    contactRoles: roles,
    contactIds: [...opp.contactIds, contactId],
    updatedAt: serverTimestamp(),
  });
  batch.set(
    newActivityRef(),
    activityDoc(opp, actor, "stakeholder_added", `Added ${input.name} as ${ROLE_LABELS[input.role]}`, {
      contactId,
    }),
  );
  await batch.commit();
}

export async function createAccount(input: NewAccountInput): Promise<string> {
  if (DEMO) return demo.createAccount(input);
  const batch = writeBatch(db);
  const ref = doc(collection(db, "accounts"));
  batch.set(ref, {
    name: input.name,
    industry: input.industry || null,
    website: input.website || null,
    phone: input.phone || null,
    notes: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return ref.id;
}

export async function createContact(input: NewContactInput): Promise<string> {
  if (DEMO) return demo.createContact(input);
  const batch = writeBatch(db);
  const account = input.account ? resolveAccount(batch, input.account) : null;
  const ref = doc(collection(db, "contacts"));
  batch.set(ref, {
    name: input.name,
    accountId: account?.accountId ?? null,
    accountName: account?.accountName ?? "",
    title: input.title || null,
    email: input.email || null,
    phone: input.phone || null,
    notes: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return ref.id;
}

export async function removeStakeholder(opp: Opportunity, contactId: string, actor: Actor): Promise<void> {
  if (DEMO) return demo.removeStakeholder(opp, contactId, actor);
  const role = opp.contactRoles.find((r) => r.contactId === contactId);
  if (!role) return;
  const batch = writeBatch(db);
  batch.update(doc(db, "opportunities", opp.id), {
    contactRoles: opp.contactRoles.filter((r) => r.contactId !== contactId),
    contactIds: opp.contactIds.filter((id) => id !== contactId),
    updatedAt: serverTimestamp(),
  });
  batch.set(
    newActivityRef(),
    activityDoc(opp, actor, "stakeholder_removed", `Removed ${role.name}`, { contactId }),
  );
  await batch.commit();
}
