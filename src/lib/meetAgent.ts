import { httpsCallable } from "firebase/functions";
import { DEMO, functions } from "../firebase";

export interface MeetAnalysis {
  summary: string;
  customerNeed: string;
  buyingSignals: string[];
  risks: string[];
  actionItems: string[];
  stakeholders: string[];
  nextAction: { text: string; dueDate: string } | null;
}

interface AnalyzeMeetTranscriptInput {
  opportunityName: string;
  accountName: string;
  transcript: string;
}

const demoAnalysis: MeetAnalysis = {
  summary:
    "Customer confirmed interest, asked for clearer implementation timing, and wants pricing/options summarized for internal review.",
  customerNeed: "A lower-risk rollout plan with concrete timing, ownership, and pricing clarity.",
  buyingSignals: ["Asked for implementation timeline", "Requested pricing summary", "Identified internal review owner"],
  risks: ["Budget timing is still unconfirmed", "Technical approver has not signed off"],
  actionItems: ["Send recap with pricing options", "Share implementation plan", "Confirm technical approver"],
  stakeholders: ["Economic buyer", "Technical approver"],
  nextAction: { text: "Send recap with pricing options and implementation plan", dueDate: nextBusinessDay() },
};

function nextBusinessDay(): string {
  const d = new Date();
  d.setDate(d.getDate() + (d.getDay() === 5 ? 3 : d.getDay() === 6 ? 2 : 1));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).map((s) => s.trim()).filter(Boolean) : [];
}

function normalize(value: unknown): MeetAnalysis {
  const raw = value as Partial<MeetAnalysis> & { nextAction?: unknown };
  const next =
    raw.nextAction && typeof raw.nextAction === "object"
      ? (raw.nextAction as Partial<{ text: unknown; dueDate: unknown }>)
      : null;
  return {
    summary: typeof raw.summary === "string" ? raw.summary : "",
    customerNeed: typeof raw.customerNeed === "string" ? raw.customerNeed : "",
    buyingSignals: asStringArray(raw.buyingSignals),
    risks: asStringArray(raw.risks),
    actionItems: asStringArray(raw.actionItems),
    stakeholders: asStringArray(raw.stakeholders),
    nextAction:
      next && typeof next.text === "string" && next.text.trim()
        ? {
            text: next.text.trim(),
            dueDate: typeof next.dueDate === "string" ? next.dueDate.trim() : "",
          }
        : null,
  };
}

export async function analyzeMeetTranscript(input: AnalyzeMeetTranscriptInput): Promise<MeetAnalysis> {
  if (DEMO) return demoAnalysis;
  const callable = httpsCallable<AnalyzeMeetTranscriptInput, MeetAnalysis>(functions, "analyzeMeetTranscript");
  const result = await callable(input);
  return normalize(result.data);
}
