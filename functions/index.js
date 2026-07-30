import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";

initializeApp();
const db = getFirestore();
const adminAuth = getAuth();

const deepseekApiKey = defineSecret("DEEPSEEK_API_KEY");
const ADMIN_EMAIL = "amidha111@gmail.com";
const RAHUL_EMAIL = "rahul@klego.ai";
const ANNE_EMAIL = "lewandowskiannm@gmail.com";
const WORK_ITEM_ASSIGNEES = new Map([
  [ADMIN_EMAIL, "Amit Midha"],
  [RAHUL_EMAIL, "Rahul Panchal"],
]);

export const prepareRahulPasswordUser = onCall(
  { region: "us-central1" },
  async (request) => {
    const token = request.auth?.token;
    const callerEmail = typeof token?.email === "string" ? token.email.toLowerCase() : "";
    if (!token?.email_verified || callerEmail !== ADMIN_EMAIL) {
      throw new HttpsError("permission-denied", "Only the CRM owner can prepare password access.");
    }
    try {
      const existing = await adminAuth.getUserByEmail(RAHUL_EMAIL);
      if (!existing.emailVerified) await adminAuth.updateUser(existing.uid, { emailVerified: true });
      return { email: RAHUL_EMAIL, created: false };
    } catch (reason) {
      if (reason?.code !== "auth/user-not-found") throw reason;
      await adminAuth.createUser({
        email: RAHUL_EMAIL,
        emailVerified: true,
        password: `${crypto.randomUUID()}-${crypto.randomUUID()}`,
        displayName: "Rahul Panchal",
      });
      return { email: RAHUL_EMAIL, created: true };
    }
  },
);

async function assertWorkItemsAllowed(request, product) {
  const token = request.auth?.token;
  const email = typeof token?.email === "string" ? token.email.trim().toLowerCase() : "";
  if (!email || !token?.email_verified) {
    throw new HttpsError("unauthenticated", "Sign in before creating a Work Item.");
  }
  if (email !== ADMIN_EMAIL && email !== RAHUL_EMAIL) {
    const allowed = await db.doc(`allowedUsers/${email}`).get();
    if (!allowed.exists) {
      throw new HttpsError("permission-denied", "This account does not have access to Work Items.");
    }
  }
  if (email === ANNE_EMAIL && product !== "plan_clarity") {
    throw new HttpsError("permission-denied", "This account can only create Plan Clarity Work Items.");
  }
  const tokenName = typeof token?.name === "string" ? token.name.trim() : "";
  return { email, name: WORK_ITEM_ASSIGNEES.get(email) ?? (tokenName || email) };
}

function oneOf(value, values, field) {
  if (!values.includes(value)) {
    throw new HttpsError("invalid-argument", `${field} is invalid.`);
  }
  return value;
}

function optionalUrl(value) {
  if (value === null || value === "") return null;
  const url = coerceString(value, "videoUrl", 2_048);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
  } catch {
    throw new HttpsError("invalid-argument", "videoUrl must be a full http or https URL.");
  }
  return url;
}

function workItemContent(value, workItemId) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new HttpsError("invalid-argument", "Work Item content is required and cannot exceed 100 blocks.");
  }
  return value.map((block) => {
    if (!block || typeof block !== "object") {
      throw new HttpsError("invalid-argument", "A Work Item content block is invalid.");
    }
    const id = coerceString(block.id, "content block id", 100);
    if (block.type === "text") {
      return { id, type: "text", text: coerceString(block.text, "content text", 50_000) };
    }
    if (block.type === "image") {
      const storagePath = coerceString(block.storagePath, "image storagePath", 1_000);
      if (!storagePath.startsWith(`workItems/${workItemId}/`)) {
        throw new HttpsError("invalid-argument", "An image does not belong to this Work Item.");
      }
      return { id, type: "image", storagePath, name: coerceString(block.name, "image name", 500) };
    }
    throw new HttpsError("invalid-argument", "A Work Item content block type is invalid.");
  });
}

function formatWorkItemReference(sequenceNumber) {
  return `WI-${String(sequenceNumber).padStart(4, "0")}`;
}

function formatRecordReference(prefix, sequenceNumber) {
  return `${prefix}-${String(sequenceNumber).padStart(4, "0")}`;
}

function numberNewRecords(collectionName, prefix) {
  return onDocumentCreated(
    { document: `${collectionName}/{recordId}`, region: "us-central1" },
    async (event) => {
      const created = event.data;
      if (!created) return;
      const recordRef = created.ref;
      const counterRef = db.doc(`systemCounters/${collectionName}`);
      await db.runTransaction(async (transaction) => {
        const [record, counter] = await Promise.all([
          transaction.get(recordRef),
          transaction.get(counterRef),
        ]);
        if (!record.exists || record.get("referenceId")) return;
        const previous = counter.exists ? counter.get("lastNumber") : 0;
        if (!Number.isSafeInteger(previous) || previous < 0) {
          throw new Error(`The ${collectionName} number counter is invalid.`);
        }
        const sequenceNumber = previous + 1;
        transaction.set(
          counterRef,
          { lastNumber: sequenceNumber, updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        );
        transaction.update(recordRef, {
          sequenceNumber,
          referenceId: formatRecordReference(prefix, sequenceNumber),
        });
      });
    },
  );
}

export const numberOpportunityRecords = numberNewRecords("opportunities", "OPP");
export const numberAccountRecords = numberNewRecords("accounts", "ACC");
export const numberContactRecords = numberNewRecords("contacts", "CON");
export const numberActivityRecords = numberNewRecords("activities", "ACT");

export const createWorkItemRecord = onCall(
  { region: "us-central1" },
  async (request) => {
    const id = coerceString(request.data?.id, "id", 100);
    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      throw new HttpsError("invalid-argument", "id contains unsupported characters.");
    }
    const raw = request.data?.input;
    if (!raw || typeof raw !== "object") {
      throw new HttpsError("invalid-argument", "Work Item input is required.");
    }
    const product = oneOf(raw.product, ["klego", "plan_clarity"], "product");
    const actor = await assertWorkItemsAllowed(request, product);
    const assigneeEmail = coerceString(raw.assigneeEmail, "assigneeEmail", 320).toLowerCase();
    const assigneeName = WORK_ITEM_ASSIGNEES.get(assigneeEmail);
    if (!assigneeName) {
      throw new HttpsError("invalid-argument", "assigneeEmail is not a Work Item assignee.");
    }
    const input = {
      type: oneOf(raw.type, ["bug", "feature"], "type"),
      product,
      subject: coerceString(raw.subject, "subject", 500),
      content: workItemContent(raw.content, id),
      videoUrl: optionalUrl(raw.videoUrl),
      priority: oneOf(raw.priority, ["low", "medium", "high"], "priority"),
      status: oneOf(raw.status, ["open", "in_progress", "ready_for_review", "closed"], "status"),
      assigneeEmail,
      assigneeName,
    };
    const itemRef = db.doc(`workItems/${id}`);
    const counterRef = db.doc("systemCounters/workItems");
    const eventRef = itemRef.collection("events").doc();
    const result = await db.runTransaction(async (transaction) => {
      const [item, counter] = await Promise.all([transaction.get(itemRef), transaction.get(counterRef)]);
      if (item.exists) throw new HttpsError("already-exists", "This Work Item already exists.");
      const previous = counter.exists ? counter.get("lastNumber") : 0;
      if (!Number.isSafeInteger(previous) || previous < 0) {
        throw new HttpsError("internal", "The Work Item number counter is invalid.");
      }
      const sequenceNumber = previous + 1;
      const referenceId = formatWorkItemReference(sequenceNumber);
      transaction.set(counterRef, { lastNumber: sequenceNumber, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(itemRef, {
        ...input,
        sequenceNumber,
        referenceId,
        createdByEmail: actor.email,
        createdByName: actor.name,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(eventRef, {
        kind: "system",
        body: `Created this ${input.type}.`,
        actorEmail: actor.email,
        actorName: actor.name,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { referenceId, sequenceNumber };
    });
    return result;
  },
);

async function assertAllowed(request) {
  const token = request.auth?.token;
  const email = typeof token?.email === "string" ? token.email.toLowerCase() : "";
  if (!email || !token?.email_verified) {
    throw new HttpsError("permission-denied", "This account does not have access to Plan Clarity.");
  }
  if (email === ADMIN_EMAIL) return;
  if (email === RAHUL_EMAIL) {
    throw new HttpsError("permission-denied", "This account only has access to Work Items.");
  }
  const allowed = await db.doc(`allowedUsers/${email}`).get();
  if (!allowed.exists) {
    throw new HttpsError("permission-denied", "This account does not have access to Plan Clarity.");
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
