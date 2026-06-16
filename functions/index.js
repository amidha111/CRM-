import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

initializeApp();
const db = getFirestore();

const deepseekApiKey = defineSecret("DEEPSEEK_API_KEY");
const ADMIN_EMAIL = "amidha111@gmail.com";

async function assertAllowed(request) {
  const token = request.auth?.token;
  const email = typeof token?.email === "string" ? token.email.toLowerCase() : "";
  if (!email || !token?.email_verified) {
    throw new HttpsError("permission-denied", "This account does not have access to Darma Foundry.");
  }
  if (email === ADMIN_EMAIL) return;
  const allowed = await db.doc(`allowedUsers/${email}`).get();
  if (!allowed.exists) {
    throw new HttpsError("permission-denied", "This account does not have access to Darma Foundry.");
  }
}

function coerceString(value, field, maxLength) {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new HttpsError("invalid-argument", `${field} is required.`);
  }
  if (trimmed.length > maxLength) {
    throw new HttpsError("invalid-argument", `${field} is too long.`);
  }
  return trimmed;
}

function parseJsonObject(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new HttpsError("internal", "DeepSeek did not return JSON.");
    return JSON.parse(match[0]);
  }
}

function normalizeAnalysis(raw) {
  const actionItems = Array.isArray(raw.actionItems)
    ? raw.actionItems.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 8)
    : [];
  const stakeholders = Array.isArray(raw.stakeholders)
    ? raw.stakeholders.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 8)
    : [];
  const risks = Array.isArray(raw.risks)
    ? raw.risks.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 6)
    : [];
  const buyingSignals = Array.isArray(raw.buyingSignals)
    ? raw.buyingSignals.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 6)
    : [];
  const nextAction = raw.nextAction && typeof raw.nextAction === "object"
    ? {
        text: typeof raw.nextAction.text === "string" ? raw.nextAction.text.trim() : "",
        dueDate: typeof raw.nextAction.dueDate === "string" ? raw.nextAction.dueDate.trim() : "",
      }
    : null;

  return {
    summary: typeof raw.summary === "string" ? raw.summary.trim() : "",
    customerNeed: typeof raw.customerNeed === "string" ? raw.customerNeed.trim() : "",
    buyingSignals,
    risks,
    actionItems,
    stakeholders,
    nextAction: nextAction?.text ? nextAction : null,
  };
}

export const analyzeMeetTranscript = onCall(
  { region: "us-central1", secrets: [deepseekApiKey], timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    await assertAllowed(request);
    const transcript = coerceString(request.data?.transcript, "transcript", 120_000);
    const opportunityName = coerceString(request.data?.opportunityName, "opportunityName", 500);
    const accountName =
      typeof request.data?.accountName === "string" ? request.data.accountName.trim().slice(0, 500) : "";

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${deepseekApiKey.value()}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        response_format: { type: "json_object" },
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "You turn sales meeting transcripts into CRM-ready notes. Return only strict JSON with keys: summary, customerNeed, buyingSignals, risks, actionItems, stakeholders, nextAction. nextAction must be either null or {text, dueDate}. dueDate must be YYYY-MM-DD or empty if unknown.",
          },
          {
            role: "user",
            content: JSON.stringify({
              opportunityName,
              accountName,
              transcript,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new HttpsError("internal", `DeepSeek request failed: ${body.slice(0, 500)}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new HttpsError("internal", "DeepSeek response was missing content.");
    }

    return normalizeAnalysis(parseJsonObject(content));
  },
);
