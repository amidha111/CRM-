export type Stage =
  | "qualification"
  | "discovery"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "closed_lost";

export const STAGES: Stage[] = [
  "qualification",
  "discovery",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
];

export const OPEN_STAGES: Stage[] = [
  "qualification",
  "discovery",
  "proposal",
  "negotiation",
];

export const STAGE_LABELS: Record<Stage, string> = {
  qualification: "Qualification",
  discovery: "Discovery",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

export type ContactRoleKind =
  | "decision_maker"
  | "economic_buyer"
  | "champion"
  | "shareholder"
  | "legal"
  | "technical_evaluator"
  | "other";

export const ROLE_LABELS: Record<ContactRoleKind, string> = {
  decision_maker: "Decision Maker",
  economic_buyer: "Economic Buyer",
  champion: "Champion",
  shareholder: "Shareholder",
  legal: "Legal",
  technical_evaluator: "Technical Evaluator",
  other: "Other",
};

export interface ContactRole {
  contactId: string;
  name: string; // denormalized from contacts
  role: ContactRoleKind;
  isPrimary: boolean;
}

export interface NextAction {
  text: string;
  dueDate: Date;
  createdAt: Date;
}

export interface Account {
  id: string;
  sequenceNumber: number;
  referenceId: string;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Opportunity {
  id: string;
  sequenceNumber: number;
  referenceId: string;
  name: string;
  accountId: string | null; // null on legacy docs and account-less quick deals
  account: string; // denormalized account name ("" when none)
  owner: string;
  amount: number;
  stage: Stage;
  closeDate: Date | null;
  notes: string;
  nextAction: NextAction | null;
  contactRoles: ContactRole[];
  contactIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type ActivityType =
  | "created"
  | "action_completed"
  | "action_set"
  | "stage_change"
  | "stakeholder_added"
  | "stakeholder_removed"
  | "call"
  | "email"
  | "meeting"
  | "note";

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  created: "Created",
  action_completed: "Action Completed",
  action_set: "Action Set",
  stage_change: "Stage Change",
  stakeholder_added: "Stakeholder Added",
  stakeholder_removed: "Stakeholder Removed",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
};

export interface Activity {
  id: string;
  sequenceNumber: number;
  referenceId: string;
  oppId: string;
  oppName: string;
  account: string;
  type: ActivityType;
  detail: string;
  note: string | null;
  link: string | null;
  fromStage: Stage | null;
  toStage: Stage | null;
  contactId: string | null;
  actor: string;
  actorUid: string;
  createdAt: Date;
}

export interface Contact {
  id: string;
  sequenceNumber: number;
  referenceId: string;
  firstName: string;
  lastName: string;
  name: string;
  accountId: string | null;
  accountName: string; // denormalized account name ("" when unaffiliated)
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Actor {
  name: string;
  uid: string;
}

export interface AllowedUser {
  id: string;
  email: string;
  displayName: string;
  disabled: boolean;
  accessRole: "full" | "work_items_only";
  workItemProducts: WorkItemProduct[];
  canAssignWorkItems: boolean;
  addedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkItemAssignee {
  email: string;
  name: string;
}

export interface WorkspaceUsage {
  storageBytes: number;
  fileCount: number;
  storageBreakdown: { label: string; bytes: number; fileCount: number }[];
  files: WorkspaceFile[];
  recordCounts: Record<string, number>;
  firestoreEstimatedBytes: number;
  estimatedStorageCostUsd: number;
  billingEnabled: boolean;
  billingExportConnected: boolean;
  billingExportStatus: "not_configured" | "waiting" | "ready" | "unavailable";
  actualGoogleCostUsd: number | null;
  previousMonthGoogleCostUsd: number | null;
  billingCurrency: string;
  billingDataThrough: string | null;
  billingReportUrl: string;
  billingExportUrl: string;
  measuredAt: Date;
}

export interface WorkspaceFile {
  name: string;
  bytes: number;
  contentType: string;
  updatedAt: Date | null;
  linkedWorkItems: { id: string; referenceId: string; subject: string }[];
}

export type WorkItemType = "bug" | "feature";
export type WorkItemProduct = "klego" | "plan_clarity";
export type WorkItemPriority = "low" | "medium" | "high";
export type WorkItemStatus = "open" | "in_progress" | "ready_for_review" | "closed";

export const WORK_ITEM_TYPE_LABELS: Record<WorkItemType, string> = {
  bug: "Bug",
  feature: "Feature",
};

export const WORK_ITEM_PRODUCT_LABELS: Record<WorkItemProduct, string> = {
  klego: "Klego",
  plan_clarity: "Plan Clarity",
};

export const WORK_ITEM_PRIORITY_LABELS: Record<WorkItemPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const WORK_ITEM_STATUS_LABELS: Record<WorkItemStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  ready_for_review: "Ready for Review",
  closed: "Resolved",
};

export type WorkItemContentBlock =
  | { id: string; type: "text"; text: string }
  | { id: string; type: "image"; storagePath: string; name: string }
  | { id: string; type: "file"; storagePath: string; name: string; contentType: string; size: number };

export interface WorkItem {
  id: string;
  sequenceNumber: number;
  referenceId: string;
  type: WorkItemType;
  product: WorkItemProduct;
  subject: string;
  content: WorkItemContentBlock[];
  videoUrl: string | null;
  priority: WorkItemPriority;
  status: WorkItemStatus;
  assigneeEmail: string;
  assigneeName: string;
  createdByEmail: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

export type WorkItemEventKind = "comment" | "system";

export interface WorkItemEvent {
  id: string;
  kind: WorkItemEventKind;
  body: string;
  actorEmail: string;
  actorName: string;
  createdAt: Date;
}

export interface WorkItemInput {
  type: WorkItemType;
  product: WorkItemProduct;
  subject: string;
  content: WorkItemContentBlock[];
  videoUrl: string | null;
  priority: WorkItemPriority;
  status: WorkItemStatus;
  assigneeEmail: string;
  assigneeName: string;
}

/** Input shapes for write operations */

/** Link an existing account or create one inline (SF-style lookup). */
export type AccountRefInput =
  | { accountId: string; name: string }
  | { accountId: null; name: string };

export interface NewOpportunityInput {
  name: string;
  account: AccountRefInput | null;
  owner: string;
  amount: number;
  stage: Stage;
  closeDate: Date | null;
  firstAction: { text: string; dueDate: Date } | null;
  stakeholder: StakeholderInput | null;
}

export interface NewAccountInput {
  name: string;
  industry?: string;
  website?: string;
  phone?: string;
}

export interface NewContactInput {
  firstName: string;
  lastName: string;
  name: string;
  account: AccountRefInput | null;
  title?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
}

export interface UpdateOpportunityInput {
  name: string;
  account: AccountRefInput | null;
  owner: string;
  amount: number;
  stage: Stage;
  closeDate: Date | null;
  notes: string;
}

export interface UpdateAccountInput {
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  notes: string;
}

export interface UpdateContactInput {
  firstName: string;
  lastName: string;
  name: string;
  account: AccountRefInput | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  notes: string;
}

export type StakeholderInput = {
  role: ContactRoleKind;
  isPrimary: boolean;
} & (
  | { contactId: string; name: string } // link existing contact
  | { contactId: null; name: string; title?: string; email?: string } // create new
);
