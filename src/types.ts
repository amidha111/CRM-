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

export interface Opportunity {
  id: string;
  name: string;
  account: string;
  owner: string;
  amount: number;
  stage: Stage;
  closeDate: Date;
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
  name: string;
  company: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Actor {
  name: string;
  uid: string;
}

/** Input shapes for write operations */
export interface NewOpportunityInput {
  name: string;
  account: string;
  owner: string;
  amount: number;
  stage: Stage;
  closeDate: Date;
  firstAction: { text: string; dueDate: Date };
  stakeholder: StakeholderInput;
}

export type StakeholderInput = {
  role: ContactRoleKind;
  isPrimary: boolean;
} & (
  | { contactId: string; name: string } // link existing contact
  | { contactId: null; name: string; title?: string; email?: string } // create new
);
