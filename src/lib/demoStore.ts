/**
 * In-memory store used when VITE_DEMO=1. Same shapes and semantics as the
 * Firestore store so the whole UI can run (and be screenshotted) without auth.
 */
import {
  ROLE_LABELS,
  STAGE_LABELS,
  type Account,
  type AccountRefInput,
  type Activity,
  type ActivityType,
  type Actor,
  type Contact,
  type NewAccountInput,
  type NewContactInput,
  type NewOpportunityInput,
  type Opportunity,
  type Stage,
  type StakeholderInput,
} from "../types";

let seq = 1000;
const id = (p: string) => `${p}_${seq++}`;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000);

const accounts: Account[] = [
  { id: "a_acme", name: "Acme Corp", industry: "Manufacturing", website: "acme.com", phone: null, notes: "", createdAt: daysAgo(40), updatedAt: daysAgo(2) },
  { id: "a_globex", name: "Globex Ltd", industry: "Technology", website: "globex.com", phone: null, notes: "", createdAt: daysAgo(30), updatedAt: daysAgo(1) },
  { id: "a_soylent", name: "Soylent Corp", industry: "Consumer Goods", website: null, phone: null, notes: "", createdAt: daysAgo(50), updatedAt: daysAgo(6) },
  { id: "a_initech", name: "Initech", industry: "Financial Services", website: null, phone: null, notes: "", createdAt: daysAgo(25), updatedAt: daysAgo(3) },
  { id: "a_hooli", name: "Hooli", industry: "Technology", website: "hooli.com", phone: null, notes: "", createdAt: daysAgo(12), updatedAt: daysAgo(12) },
];

const contacts: Contact[] = [
  { id: "c_priya", name: "Priya Shah", accountId: "a_acme", accountName: "Acme Corp", title: "CFO", email: "priya@acme.com", phone: null, notes: "", createdAt: daysAgo(40), updatedAt: daysAgo(2) },
  { id: "c_jane", name: "Jane Doe", accountId: "a_acme", accountName: "Acme Corp", title: "VP Engineering", email: "jane@acme.com", phone: null, notes: "", createdAt: daysAgo(38), updatedAt: daysAgo(5) },
  { id: "c_tom", name: "Tom Berenger", accountId: "a_globex", accountName: "Globex Ltd", title: "CTO", email: "tom@globex.com", phone: null, notes: "", createdAt: daysAgo(30), updatedAt: daysAgo(1) },
  { id: "c_amara", name: "Amara Okafor", accountId: "a_initech", accountName: "Initech", title: "Board member", email: null, phone: null, notes: "", createdAt: daysAgo(25), updatedAt: daysAgo(3) },
  { id: "c_dev", name: "Dev Patel", accountId: "a_hooli", accountName: "Hooli", title: "Head of Data", email: "dev@hooli.com", phone: null, notes: "", createdAt: daysAgo(12), updatedAt: daysAgo(12) },
];

const opportunities: Opportunity[] = [
  {
    id: "o_acme", name: "Enterprise Expansion", accountId: "a_acme", account: "Acme Corp", owner: "Amit", amount: 120000,
    stage: "proposal", closeDate: daysAhead(20), notes: "Q3 budget confirmed.",
    nextAction: { text: "Send revised SOW", dueDate: daysAgo(0), createdAt: daysAgo(2) },
    contactRoles: [
      { contactId: "c_priya", name: "Priya Shah", role: "economic_buyer", isPrimary: true },
      { contactId: "c_jane", name: "Jane Doe", role: "champion", isPrimary: false },
    ],
    contactIds: ["c_priya", "c_jane"],
    createdAt: daysAgo(35), updatedAt: daysAgo(0),
  },
  {
    id: "o_globex", name: "Cloud Migration Phase 2", accountId: "a_globex", account: "Globex Ltd", owner: "Amit", amount: 85000,
    stage: "negotiation", closeDate: daysAhead(12), notes: "",
    nextAction: { text: "Book technical demo", dueDate: daysAhead(1), createdAt: daysAgo(1) },
    contactRoles: [{ contactId: "c_tom", name: "Tom Berenger", role: "decision_maker", isPrimary: true }],
    contactIds: ["c_tom"],
    createdAt: daysAgo(28), updatedAt: daysAgo(1),
  },
  {
    id: "o_soylent", name: "Security Suite Licensing", accountId: "a_soylent", account: "Soylent Corp", owner: "Linisha", amount: 42500,
    stage: "closed_won", closeDate: daysAgo(6), notes: "",
    nextAction: null,
    contactRoles: [{ contactId: "c_priya", name: "Priya Shah", role: "shareholder", isPrimary: true }],
    contactIds: ["c_priya"],
    createdAt: daysAgo(50), updatedAt: daysAgo(6),
  },
  {
    id: "o_initech", name: "Infrastructure Audit", accountId: "a_initech", account: "Initech", owner: "Amit", amount: 12000,
    stage: "discovery", closeDate: daysAhead(35), notes: "",
    nextAction: { text: "Confirm budget owner", dueDate: daysAhead(2), createdAt: daysAgo(3) },
    contactRoles: [
      { contactId: "c_amara", name: "Amara Okafor", role: "shareholder", isPrimary: true },
      { contactId: "c_priya", name: "Priya Shah", role: "shareholder", isPrimary: false },
    ],
    contactIds: ["c_amara", "c_priya"],
    createdAt: daysAgo(20), updatedAt: daysAgo(19),
  },
  {
    id: "o_hooli", name: "Data Analytics Pilot", accountId: "a_hooli", account: "Hooli", owner: "Linisha", amount: 24000,
    stage: "qualification", closeDate: daysAhead(45), notes: "",
    nextAction: { text: "Book discovery call", dueDate: daysAgo(2), createdAt: daysAgo(10) },
    contactRoles: [{ contactId: "c_dev", name: "Dev Patel", role: "technical_evaluator", isPrimary: true }],
    contactIds: ["c_dev"],
    createdAt: daysAgo(12), updatedAt: daysAgo(16),
  },
];

const activities: Activity[] = [
  {
    id: id("a"), oppId: "o_acme", oppName: "Enterprise Expansion", account: "Acme Corp",
    type: "stage_change", detail: "Moved from Discovery to Proposal", note: null, link: null,
    fromStage: "discovery", toStage: "proposal", contactId: null, actor: "Amit", actorUid: "demo",
    createdAt: daysAgo(2),
  },
  {
    id: id("a"), oppId: "o_acme", oppName: "Enterprise Expansion", account: "Acme Corp",
    type: "meeting", detail: "Meeting logged", note: "Met with CFO — pricing structure agreed in principle.",
    link: null, fromStage: null, toStage: null, contactId: "c_priya", actor: "Amit", actorUid: "demo",
    createdAt: daysAgo(2),
  },
  {
    id: id("a"), oppId: "o_globex", oppName: "Cloud Migration Phase 2", account: "Globex Ltd",
    type: "action_completed", detail: 'Completed "Send deck follow-up"', note: null, link: null,
    fromStage: null, toStage: null, contactId: null, actor: "Amit", actorUid: "demo",
    createdAt: daysAgo(1),
  },
  {
    id: id("a"), oppId: "o_soylent", oppName: "Security Suite Licensing", account: "Soylent Corp",
    type: "stage_change", detail: "Moved from Negotiation to Closed Won", note: null, link: null,
    fromStage: "negotiation", toStage: "closed_won", contactId: null, actor: "Linisha", actorUid: "demo",
    createdAt: daysAgo(6),
  },
  {
    id: id("a"), oppId: "o_hooli", oppName: "Data Analytics Pilot", account: "Hooli",
    type: "created", detail: 'Created opportunity "Data Analytics Pilot" for Hooli', note: null, link: null,
    fromStage: null, toStage: null, contactId: null, actor: "Linisha", actorUid: "demo",
    createdAt: daysAgo(12),
  },
];

type Listener<T> = (v: T[]) => void;
const oppListeners = new Set<Listener<Opportunity>>();
const actListeners = new Set<Listener<Activity>>();
const contactListeners = new Set<Listener<Contact>>();
const accountListeners = new Set<Listener<Account>>();

function emit() {
  const opps = [...opportunities].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const acts = [...activities].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const cons = [...contacts].sort((a, b) => a.name.localeCompare(b.name));
  const accs = [...accounts].sort((a, b) => a.name.localeCompare(b.name));
  oppListeners.forEach((l) => l(opps));
  actListeners.forEach((l) => l(acts));
  contactListeners.forEach((l) => l(cons));
  accountListeners.forEach((l) => l(accs));
}

export function subscribeOpportunities(cb: Listener<Opportunity>) {
  oppListeners.add(cb);
  cb([...opportunities].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
  return () => oppListeners.delete(cb);
}
export function subscribeActivities(cb: Listener<Activity>) {
  actListeners.add(cb);
  cb([...activities].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
  return () => actListeners.delete(cb);
}
export function subscribeContacts(cb: Listener<Contact>) {
  contactListeners.add(cb);
  cb([...contacts].sort((a, b) => a.name.localeCompare(b.name)));
  return () => contactListeners.delete(cb);
}
export function subscribeAccounts(cb: Listener<Account>) {
  accountListeners.add(cb);
  cb([...accounts].sort((a, b) => a.name.localeCompare(b.name)));
  return () => accountListeners.delete(cb);
}

function pushActivity(
  opp: { id: string; name: string; account: string },
  actor: Actor,
  type: ActivityType,
  detail: string,
  extra?: Partial<Pick<Activity, "note" | "link" | "fromStage" | "toStage" | "contactId">>,
) {
  activities.push({
    id: id("a"),
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
    createdAt: new Date(),
  });
}

function resolveAccount(input: AccountRefInput): { accountId: string; accountName: string } {
  if (input.accountId) return { accountId: input.accountId, accountName: input.name };
  const aid = id("a");
  accounts.push({
    id: aid, name: input.name, industry: null, website: null, phone: null, notes: "",
    createdAt: new Date(), updatedAt: new Date(),
  });
  return { accountId: aid, accountName: input.name };
}

function resolveContact(input: StakeholderInput, account: { accountId: string | null; accountName: string }): string {
  if (input.contactId) return input.contactId;
  const cid = id("c");
  contacts.push({
    id: cid,
    name: input.name,
    accountId: account.accountId,
    accountName: account.accountName,
    title: ("title" in input && input.title) || null,
    email: ("email" in input && input.email) || null,
    phone: null,
    notes: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return cid;
}

function find(oppId: string): Opportunity {
  const o = opportunities.find((x) => x.id === oppId);
  if (!o) throw new Error("opp not found");
  return o;
}

export async function createOpportunity(input: NewOpportunityInput, actor: Actor): Promise<string> {
  const account = input.account ? resolveAccount(input.account) : { accountId: null, accountName: "" };
  const roles = [];
  if (input.stakeholder) {
    const contactId = resolveContact(input.stakeholder, account);
    roles.push({ contactId, name: input.stakeholder.name, role: input.stakeholder.role, isPrimary: true });
  }
  const oppId = id("o");
  opportunities.push({
    id: oppId,
    name: input.name,
    accountId: account.accountId,
    account: account.accountName,
    owner: input.owner,
    amount: input.amount,
    stage: input.stage,
    closeDate: input.closeDate,
    notes: "",
    nextAction: input.firstAction
      ? { text: input.firstAction.text, dueDate: input.firstAction.dueDate, createdAt: new Date() }
      : null,
    contactRoles: roles,
    contactIds: roles.map((r) => r.contactId),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const ref = { id: oppId, name: input.name, account: account.accountName };
  pushActivity(ref, actor, "created", `Created opportunity "${input.name}"${account.accountName ? ` for ${account.accountName}` : ""}`);
  if (input.firstAction) pushActivity(ref, actor, "action_set", `Set next action "${input.firstAction.text}"`);
  emit();
  return oppId;
}

export async function completeNextAction(
  opp: Opportunity,
  next: { text: string; dueDate: Date } | null,
  actor: Actor,
): Promise<void> {
  const o = find(opp.id);
  if (!o.nextAction) return;
  pushActivity(o, actor, "action_completed", `Completed "${o.nextAction.text}"`);
  if (next) pushActivity(o, actor, "action_set", `Set next action "${next.text}"`);
  o.nextAction = next ? { text: next.text, dueDate: next.dueDate, createdAt: new Date() } : null;
  o.updatedAt = new Date();
  emit();
}

export async function setNextAction(
  opp: Opportunity,
  next: { text: string; dueDate: Date },
  actor: Actor,
): Promise<void> {
  const o = find(opp.id);
  pushActivity(o, actor, "action_set", `Set next action "${next.text}"`);
  o.nextAction = { text: next.text, dueDate: next.dueDate, createdAt: new Date() };
  o.updatedAt = new Date();
  emit();
}

export async function changeStage(opp: Opportunity, toStage: Stage, actor: Actor): Promise<void> {
  const o = find(opp.id);
  if (o.stage === toStage) return;
  pushActivity(o, actor, "stage_change", `Moved from ${STAGE_LABELS[o.stage]} to ${STAGE_LABELS[toStage]}`, {
    fromStage: o.stage,
    toStage,
  });
  o.stage = toStage;
  if (toStage === "closed_won" || toStage === "closed_lost") o.nextAction = null;
  o.updatedAt = new Date();
  emit();
}

export async function logTouch(
  opp: Opportunity,
  type: "call" | "email" | "meeting" | "note",
  note: string,
  link: string | null,
  newAction: { text: string; dueDate: Date } | null,
  actor: Actor,
): Promise<void> {
  const o = find(opp.id);
  const labels = { call: "Call", email: "Email", meeting: "Meeting", note: "Note" };
  pushActivity(o, actor, type, `${labels[type]} logged`, { note, link });
  if (newAction) {
    pushActivity(o, actor, "action_set", `Set next action "${newAction.text}"`);
    o.nextAction = { text: newAction.text, dueDate: newAction.dueDate, createdAt: new Date() };
  }
  o.updatedAt = new Date();
  emit();
}

export async function addStakeholder(opp: Opportunity, input: StakeholderInput, actor: Actor): Promise<void> {
  const o = find(opp.id);
  const contactId = resolveContact(input, { accountId: o.accountId, accountName: o.account });
  if (o.contactIds.includes(contactId)) return;
  if (input.isPrimary) o.contactRoles = o.contactRoles.map((r) => ({ ...r, isPrimary: false }));
  o.contactRoles = [...o.contactRoles, { contactId, name: input.name, role: input.role, isPrimary: input.isPrimary }];
  o.contactIds = [...o.contactIds, contactId];
  o.updatedAt = new Date();
  pushActivity(o, actor, "stakeholder_added", `Added ${input.name} as ${ROLE_LABELS[input.role]}`, { contactId });
  emit();
}

export async function removeStakeholder(opp: Opportunity, contactId: string, actor: Actor): Promise<void> {
  const o = find(opp.id);
  const role = o.contactRoles.find((r) => r.contactId === contactId);
  if (!role) return;
  o.contactRoles = o.contactRoles.filter((r) => r.contactId !== contactId);
  o.contactIds = o.contactIds.filter((x) => x !== contactId);
  o.updatedAt = new Date();
  pushActivity(o, actor, "stakeholder_removed", `Removed ${role.name}`, { contactId });
  emit();
}

export async function createAccount(input: NewAccountInput): Promise<string> {
  const aid = id("a");
  accounts.push({
    id: aid, name: input.name, industry: input.industry || null, website: input.website || null,
    phone: input.phone || null, notes: "", createdAt: new Date(), updatedAt: new Date(),
  });
  emit();
  return aid;
}

export async function createContact(input: NewContactInput): Promise<string> {
  const account = input.account ? resolveAccount(input.account) : null;
  const cid = id("c");
  contacts.push({
    id: cid, name: input.name, accountId: account?.accountId ?? null, accountName: account?.accountName ?? "",
    title: input.title || null, email: input.email || null, phone: input.phone || null, notes: "",
    createdAt: new Date(), updatedAt: new Date(),
  });
  emit();
  return cid;
}
