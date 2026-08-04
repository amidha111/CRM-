import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { BigQuery } from "@google-cloud/bigquery";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";

initializeApp();
const db = getFirestore();
const adminAuth = getAuth();
const PROJECT_ID = "founderflow-crm-af1";
const BILLING_DATASET_ID = "cloud_billing_export";
const bigQuery = new BigQuery({ projectId: PROJECT_ID });

setGlobalOptions({
  serviceAccount: "crm-runtime@founderflow-crm-af1.iam.gserviceaccount.com",
  enforceAppCheck: true,
  maxInstances: 10,
});

const deepseekApiKey = defineSecret("DEEPSEEK_API_KEY");
const ADMIN_EMAIL = "amidha111@gmail.com";
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/rtf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const DAILY_UPLOAD_LIMIT = 40;
const DAILY_UPLOAD_BYTES_LIMIT = 100 * 1024 * 1024;
const DAILY_AI_CALL_LIMIT = 20;
const DAILY_AI_CHARACTER_LIMIT = 500_000;
const AI_MIN_INTERVAL_MS = 10_000;

function requestEmail(request) {
  return typeof request.auth?.token?.email === "string"
    ? request.auth.token.email.trim().toLowerCase()
    : "";
}

async function assertAdminRequest(request) {
  const email = requestEmail(request);
  if (!request.auth?.token?.email_verified || email !== ADMIN_EMAIL) {
    throw new HttpsError("permission-denied", "Only the CRM owner can manage workspace users.");
  }
  return email;
}

async function accessRecord(email) {
  if (email === ADMIN_EMAIL) {
    return {
      email: ADMIN_EMAIL,
      displayName: "Amit Midha",
      disabled: false,
      accessRole: "full",
      workItemProducts: ["klego", "plan_clarity"],
      canAssignWorkItems: true,
    };
  }
  const snapshot = await db.doc(`allowedUsers/${email}`).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  return {
    email,
    displayName: typeof data.displayName === "string" && data.displayName.trim()
      ? data.displayName.trim()
      : email.split("@")[0],
    disabled: data.disabled === true,
    accessRole: data.accessRole === "work_items_only" ? "work_items_only" : "full",
    workItemProducts: Array.isArray(data.workItemProducts) ? data.workItemProducts : ["klego", "plan_clarity"],
    canAssignWorkItems: data.canAssignWorkItems === true,
  };
}

export const preparePasswordUser = onCall(
  { region: "us-central1" },
  async (request) => {
    await assertAdminRequest(request);
    const email = coerceString(request.data?.email, "email", 320).toLowerCase();
    const access = await accessRecord(email);
    if (!access || access.disabled) {
      throw new HttpsError("failed-precondition", "Enable this CRM user before sending a password reset.");
    }
    try {
      const existing = await adminAuth.getUserByEmail(email);
      await adminAuth.updateUser(existing.uid, {
        displayName: access.displayName,
        disabled: false,
        emailVerified: true,
      });
      return { email, created: false };
    } catch (reason) {
      if (reason?.code !== "auth/user-not-found") throw reason;
      await adminAuth.createUser({
        email,
        emailVerified: true,
        password: `${crypto.randomUUID()}-${crypto.randomUUID()}`,
        displayName: access.displayName,
      });
      return { email, created: true };
    }
  },
);

export const listWorkItemAssignees = onCall(
  { region: "us-central1" },
  async (request) => {
    const email = requestEmail(request);
    if (!request.auth?.token?.email_verified) {
      throw new HttpsError("unauthenticated", "Sign in to view Work Item assignees.");
    }
    const caller = await accessRecord(email);
    if (!caller || caller.disabled) {
      throw new HttpsError("permission-denied", "This account does not have CRM access.");
    }
    const snapshot = await db.collection("allowedUsers").get();
    const people = [{ email: ADMIN_EMAIL, name: "Amit Midha" }];
    snapshot.docs.forEach((record) => {
      const data = record.data();
      if (data.disabled === true || data.canAssignWorkItems !== true) return;
      people.push({
        email: String(data.email ?? record.id).toLowerCase(),
        name: String(data.displayName ?? data.email ?? record.id),
      });
    });
    return people.sort((left, right) => left.name.localeCompare(right.name));
  },
);

function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

async function consumeUploadQuota(uid, bytes) {
  const quotaRef = db.doc(`securityUsage/${uid}_${utcDayKey()}`);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(quotaRef);
    const uploadCount = snapshot.exists ? Number(snapshot.get("uploadCount") ?? 0) : 0;
    const uploadBytes = snapshot.exists ? Number(snapshot.get("uploadBytes") ?? 0) : 0;
    if (uploadCount >= DAILY_UPLOAD_LIMIT || uploadBytes + bytes > DAILY_UPLOAD_BYTES_LIMIT) {
      throw new HttpsError("resource-exhausted", "Your daily Work Item upload allowance has been reached.");
    }
    transaction.set(quotaRef, {
      uploadCount: uploadCount + 1,
      uploadBytes: uploadBytes + bytes,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

async function consumeAiQuota(uid, characters) {
  const quotaRef = db.doc(`securityUsage/${uid}_${utcDayKey()}`);
  const now = Date.now();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(quotaRef);
    const aiCalls = snapshot.exists ? Number(snapshot.get("aiCalls") ?? 0) : 0;
    const aiCharacters = snapshot.exists ? Number(snapshot.get("aiCharacters") ?? 0) : 0;
    const lastAiAt = snapshot.exists ? snapshot.get("lastAiAt") : null;
    if (lastAiAt?.toMillis && now - lastAiAt.toMillis() < AI_MIN_INTERVAL_MS) {
      throw new HttpsError("resource-exhausted", "Wait a few seconds before running another transcript analysis.");
    }
    if (aiCalls >= DAILY_AI_CALL_LIMIT || aiCharacters + characters > DAILY_AI_CHARACTER_LIMIT) {
      throw new HttpsError("resource-exhausted", "Your daily transcript analysis allowance has been reached.");
    }
    transaction.set(quotaRef, {
      aiCalls: aiCalls + 1,
      aiCharacters: aiCharacters + characters,
      lastAiAt: Timestamp.fromMillis(now),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

export const createWorkItemUploadGrant = onCall(
  { region: "us-central1", maxInstances: 10 },
  async (request) => {
    const workItemId = coerceString(request.data?.workItemId, "workItemId", 100);
    if (!/^[A-Za-z0-9_-]+$/.test(workItemId)) {
      throw new HttpsError("invalid-argument", "workItemId contains unsupported characters.");
    }
    const product = oneOf(request.data?.product, ["klego", "plan_clarity"], "product");
    const blockType = oneOf(request.data?.blockType ?? "image", ["image", "file"], "blockType");
    const actor = await assertWorkItemsAllowed(request, product);
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in before uploading a Work Item file.");
    const fileSize = request.data?.fileSize;
    const maximumBytes = blockType === "image" ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
    if (!Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > maximumBytes) {
      throw new HttpsError("invalid-argument", `The ${blockType} size is invalid.`);
    }
    const contentType = coerceString(request.data?.contentType, "contentType", 100).toLowerCase();
    if (blockType === "image" && !ALLOWED_IMAGE_TYPES.has(contentType)) {
      throw new HttpsError("invalid-argument", "Use a PNG, JPEG, GIF, or WebP screenshot.");
    }
    if (blockType === "file" && !ALLOWED_FILE_TYPES.has(contentType)) {
      throw new HttpsError("invalid-argument", "Use a supported PDF, text, Office, or ZIP file.");
    }
    const originalName = coerceString(request.data?.fileName, "fileName", 500);
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "image";
    const existing = await db.doc(`workItems/${workItemId}`).get();
    if (existing.exists && existing.get("product") !== product) {
      throw new HttpsError("failed-precondition", "The uploaded file product does not match this Work Item.");
    }
    await consumeUploadQuota(uid, fileSize);
    const grantRef = db.collection("workItemUploadGrants").doc();
    const storagePath = `workItems/${workItemId}/${grantRef.id}/${safeName}`;
    await grantRef.set({
      uid,
      email: actor.email,
      workItemId,
      product,
      storagePath,
      fileSize,
      contentType,
      blockType,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 15 * 60 * 1000),
    });
    return { storagePath };
  },
);

async function commitInChunks(updates) {
  for (let start = 0; start < updates.length; start += 450) {
    const batch = db.batch();
    updates.slice(start, start + 450).forEach(({ ref, data }) => batch.update(ref, data));
    await batch.commit();
  }
}

export const updateWorkspaceUser = onCall(
  { region: "us-central1" },
  async (request) => {
    await assertAdminRequest(request);
    const currentEmail = coerceString(request.data?.currentEmail, "currentEmail", 320).toLowerCase();
    const email = coerceString(request.data?.email, "email", 320).toLowerCase();
    const displayName = coerceString(request.data?.displayName, "displayName", 200);
    const disabled = request.data?.disabled === true;
    if (![currentEmail, email].every((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) {
      throw new HttpsError("invalid-argument", "Enter a valid access email.");
    }
    if (currentEmail === ADMIN_EMAIL || email === ADMIN_EMAIL) {
      throw new HttpsError("failed-precondition", "The permanent owner record cannot be changed here.");
    }
    const currentRef = db.doc(`allowedUsers/${currentEmail}`);
    const current = await currentRef.get();
    if (!current.exists) throw new HttpsError("not-found", "This workspace user no longer exists.");
    if (email !== currentEmail && (await db.doc(`allowedUsers/${email}`).get()).exists) {
      throw new HttpsError("already-exists", "Another workspace user already uses that email.");
    }

    let authUser = null;
    try {
      authUser = await adminAuth.getUserByEmail(currentEmail);
      if (email !== currentEmail) {
        try {
          await adminAuth.getUserByEmail(email);
          throw new HttpsError("already-exists", "A Firebase account already uses that email.");
        } catch (reason) {
          if (reason instanceof HttpsError) throw reason;
          if (reason?.code !== "auth/user-not-found") throw reason;
        }
      }
    } catch (reason) {
      if (reason?.code !== "auth/user-not-found") throw reason;
    }

    if (authUser) {
      await adminAuth.updateUser(authUser.uid, { email, displayName, disabled });
    }

    const data = current.data();
    await db.runTransaction(async (transaction) => {
      transaction.set(db.doc(`allowedUsers/${email}`), {
        ...data,
        email,
        displayName,
        disabled,
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (email !== currentEmail) transaction.delete(currentRef);
    });

    const assigned = await db.collection("workItems").where("assigneeEmail", "==", currentEmail).get();
    await commitInChunks(assigned.docs.map((record) => ({
      ref: record.ref,
      data: { assigneeEmail: email, assigneeName: displayName, updatedAt: FieldValue.serverTimestamp() },
    })));
    return { email, displayName, disabled, updatedWorkItems: assigned.size };
  },
);

export const getWorkspaceUsage = onCall(
  { region: "us-central1", timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    await assertAdminRequest(request);
    const bucket = getStorage().bucket("founderflow-crm-af1.firebasestorage.app");
    const [files] = await bucket.getFiles();
    const workItems = await db.collection("workItems").get();
    const workItemData = workItems.docs.map((record) => ({
      id: record.id,
      referenceId: String(record.get("referenceId") ?? record.id),
      subject: String(record.get("subject") ?? "Untitled Work Item"),
      content: Array.isArray(record.get("content")) ? record.get("content") : [],
    }));
    const fileMetadata = await Promise.all(files.map(async (file) => {
      const [metadata] = await file.getMetadata();
      return {
        name: file.name,
        bytes: Number(metadata.size ?? 0),
        contentType: String(metadata.contentType ?? "application/octet-stream"),
        updatedAt: metadata.updated ?? null,
        linkedWorkItems: workItemData
          .filter((workItem) => workItem.content.some((block) => block?.storagePath === file.name))
          .map(({ id, referenceId, subject }) => ({ id, referenceId, subject })),
      };
    }));
    const breakdown = new Map();
    fileMetadata.forEach(({ name, bytes }) => {
      const label = name.startsWith("workItems/") ? "Work Item attachments" : (name.split("/")[0] || "Other files");
      const current = breakdown.get(label) ?? { label, bytes: 0, fileCount: 0 };
      current.bytes += bytes;
      current.fileCount += 1;
      breakdown.set(label, current);
    });
    const collectionNames = ["accounts", "contacts", "opportunities", "activities", "workItems", "allowedUsers"];
    const counts = await Promise.all(collectionNames.map(async (name) => {
      const snapshot = await db.collection(name).count().get();
      return [name, snapshot.data().count];
    }));
    const estimateSnapshots = await Promise.all(collectionNames.map((name) => db.collection(name).get()));
    const events = await db.collectionGroup("events").get();
    const firestoreEstimatedBytes = [...estimateSnapshots.flatMap((snapshot) => snapshot.docs), ...events.docs]
      .reduce((sum, record) => sum + Buffer.byteLength(record.ref.path) + Buffer.byteLength(JSON.stringify(record.data())), 0);
    const gib = 1024 ** 3;
    const storageBillableGib = Math.max(0, fileMetadata.reduce((sum, file) => sum + file.bytes, 0) / gib - 5);
    const firestoreBillableGib = Math.max(0, firestoreEstimatedBytes / gib - 1);
    const estimatedStorageCostUsd = storageBillableGib * 0.02 + firestoreBillableGib * 0.000205479 * 730;
    let billing = {
      billingExportConnected: false,
      billingExportStatus: "not_configured",
      actualGoogleCostUsd: null,
      previousMonthGoogleCostUsd: null,
      billingCurrency: "USD",
      billingDataThrough: null,
    };
    try {
      const [tables] = await bigQuery.dataset(BILLING_DATASET_ID).getTables();
      const standardTable = tables.find((table) => /^gcp_billing_export_v1_[A-F0-9_]+$/.test(table.id ?? ""));
      if (standardTable?.id) {
        const [rows] = await bigQuery.query({
          location: "US",
          query: `
            WITH project_cost AS (
              SELECT
                usage_start_time,
                export_time,
                currency,
                cost + IFNULL((SELECT SUM(credit.amount) FROM UNNEST(credits) AS credit), 0) AS net_cost
              FROM \`${PROJECT_ID}.${BILLING_DATASET_ID}.${standardTable.id}\`
              WHERE project.id = @projectId
                AND usage_start_time >= TIMESTAMP_TRUNC(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 MONTH), MONTH)
            )
            SELECT
              ROUND(IFNULL(SUM(IF(usage_start_time >= TIMESTAMP_TRUNC(CURRENT_TIMESTAMP(), MONTH), net_cost, 0)), 0), 2) AS current_month_cost,
              ROUND(IFNULL(SUM(IF(
                usage_start_time >= TIMESTAMP_TRUNC(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 MONTH), MONTH)
                AND usage_start_time < TIMESTAMP_TRUNC(CURRENT_TIMESTAMP(), MONTH),
                net_cost,
                0
              )), 0), 2) AS previous_month_cost,
              ANY_VALUE(currency) AS currency,
              MAX(export_time) AS data_through
            FROM project_cost
          `,
          params: { projectId: PROJECT_ID },
        });
        const row = rows[0] ?? {};
        billing = {
          billingExportConnected: true,
          billingExportStatus: "ready",
          actualGoogleCostUsd: Number(row.current_month_cost ?? 0),
          previousMonthGoogleCostUsd: Number(row.previous_month_cost ?? 0),
          billingCurrency: String(row.currency ?? "USD"),
          billingDataThrough: row.data_through?.value ?? row.data_through ?? null,
        };
      } else {
        billing.billingExportStatus = "waiting";
      }
    } catch (reason) {
      console.error("Unable to read Cloud Billing export", reason instanceof Error ? reason.message : reason);
      billing.billingExportStatus = "unavailable";
    }
    return {
      storageBytes: fileMetadata.reduce((sum, file) => sum + file.bytes, 0),
      fileCount: fileMetadata.length,
      storageBreakdown: [...breakdown.values()].sort((left, right) => right.bytes - left.bytes),
      files: fileMetadata.sort((left, right) => right.bytes - left.bytes),
      recordCounts: Object.fromEntries(counts),
      firestoreEstimatedBytes,
      estimatedStorageCostUsd,
      billingEnabled: true,
      ...billing,
      billingReportUrl: "https://console.cloud.google.com/billing/0192AB-30A8EF-2E84A2/reports?project=founderflow-crm-af1",
      billingExportUrl: "https://console.cloud.google.com/billing/0192AB-30A8EF-2E84A2/export?project=founderflow-crm-af1",
      measuredAt: new Date().toISOString(),
    };
  },
);

export const deleteWorkspaceFile = onCall(
  { region: "us-central1", timeoutSeconds: 120 },
  async (request) => {
    const actorEmail = await assertAdminRequest(request);
    const storagePath = coerceString(request.data?.storagePath, "storagePath", 1_000);
    if (storagePath.startsWith("/") || storagePath.includes("..")) {
      throw new HttpsError("invalid-argument", "The storage path is invalid.");
    }
    const bucket = getStorage().bucket("founderflow-crm-af1.firebasestorage.app");
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) throw new HttpsError("not-found", "This file no longer exists.");

    const [workItems, uploadGrants] = await Promise.all([
      db.collection("workItems").get(),
      db.collection("workItemUploadGrants").where("storagePath", "==", storagePath).get(),
    ]);
    const linked = workItems.docs.flatMap((record) => {
      const content = Array.isArray(record.get("content")) ? record.get("content") : [];
      const nextContent = content.filter((block) => block?.storagePath !== storagePath);
      return nextContent.length === content.length ? [] : [{ record, nextContent }];
    });
    for (let start = 0; start < linked.length; start += 200) {
      const batch = db.batch();
      linked.slice(start, start + 200).forEach(({ record, nextContent }) => {
        batch.update(record.ref, { content: nextContent, updatedAt: FieldValue.serverTimestamp() });
        batch.set(record.ref.collection("events").doc(), {
          kind: "system",
          body: `Removed stored file ${storagePath}.`,
          actorEmail,
          actorName: "Amit Midha",
          createdAt: FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }
    for (let start = 0; start < uploadGrants.docs.length; start += 400) {
      const batch = db.batch();
      uploadGrants.docs.slice(start, start + 400).forEach((record) => batch.delete(record.ref));
      await batch.commit();
    }
    await file.delete();
    return {
      storagePath,
      updatedWorkItems: linked.length,
      deletedFirestoreRecords: linked.length + uploadGrants.size,
    };
  },
);

async function assertWorkItemsAllowed(request, product) {
  const token = request.auth?.token;
  const email = typeof token?.email === "string" ? token.email.trim().toLowerCase() : "";
  if (!email || !token?.email_verified) {
    throw new HttpsError("unauthenticated", "Sign in before creating a Work Item.");
  }
  const access = await accessRecord(email);
  if (!access || access.disabled) {
    throw new HttpsError("permission-denied", "This account does not have access to Work Items.");
  }
  if (!access.workItemProducts.includes(product)) {
    throw new HttpsError("permission-denied", "This account can only create Plan Clarity Work Items.");
  }
  const tokenName = typeof token?.name === "string" ? token.name.trim() : "";
  return { email, name: access.displayName || tokenName || email };
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
    if (block.type === "file") {
      const storagePath = coerceString(block.storagePath, "file storagePath", 1_000);
      if (!storagePath.startsWith(`workItems/${workItemId}/`)) {
        throw new HttpsError("invalid-argument", "A file does not belong to this Work Item.");
      }
      const contentType = coerceString(block.contentType, "file contentType", 100).toLowerCase();
      if (!ALLOWED_FILE_TYPES.has(contentType)) {
        throw new HttpsError("invalid-argument", "A Work Item file type is invalid.");
      }
      const size = block.size;
      if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_FILE_BYTES) {
        throw new HttpsError("invalid-argument", "A Work Item file size is invalid.");
      }
      return {
        id,
        type: "file",
        storagePath,
        name: coerceString(block.name, "file name", 500),
        contentType,
        size,
      };
    }
    throw new HttpsError("invalid-argument", "A Work Item content block type is invalid.");
  });
}

function uploadGrantId(storagePath, workItemId) {
  const match = storagePath.match(new RegExp(`^workItems/${workItemId}/([A-Za-z0-9_-]+)/[^/]+$`));
  if (!match) throw new HttpsError("invalid-argument", "A Work Item attachment is missing its secure upload grant.");
  return match[1];
}

function assertValidUploadGrant(snapshot, block, workItemId, actorEmail) {
  if (!snapshot.exists) throw new HttpsError("failed-precondition", "A Work Item upload grant has expired or was already used.");
  const data = snapshot.data();
  if (
    data.email !== actorEmail
    || data.workItemId !== workItemId
    || data.storagePath !== block.storagePath
    || (data.blockType != null && data.blockType !== block.type)
    || !data.expiresAt?.toMillis
    || data.expiresAt.toMillis() <= Date.now()
  ) {
    throw new HttpsError("permission-denied", "A Work Item upload grant is invalid.");
  }
}

async function assertUploadedFilesExist(blocks) {
  const bucket = getStorage().bucket("founderflow-crm-af1.firebasestorage.app");
  await Promise.all(blocks.map(async (block) => {
    const [exists] = await bucket.file(block.storagePath).exists();
    if (!exists) throw new HttpsError("failed-precondition", `${block.name} did not finish uploading.`);
  }));
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
    const assignee = await accessRecord(assigneeEmail);
    if (!assignee || assignee.disabled || !assignee.canAssignWorkItems) {
      throw new HttpsError("invalid-argument", "assigneeEmail is not a Work Item assignee.");
    }
    const assigneeName = assignee.displayName;
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
    const uploadedBlocks = input.content.filter((block) => block.type === "image" || block.type === "file");
    const grantRefs = uploadedBlocks.map((block) => db.doc(`workItemUploadGrants/${uploadGrantId(block.storagePath, id)}`));
    await assertUploadedFilesExist(uploadedBlocks);
    const itemRef = db.doc(`workItems/${id}`);
    const counterRef = db.doc("systemCounters/workItems");
    const eventRef = itemRef.collection("events").doc();
    const result = await db.runTransaction(async (transaction) => {
      const [item, counter, ...grants] = await Promise.all([
        transaction.get(itemRef),
        transaction.get(counterRef),
        ...grantRefs.map((ref) => transaction.get(ref)),
      ]);
      if (item.exists) throw new HttpsError("already-exists", "This Work Item already exists.");
      grants.forEach((grant, index) => assertValidUploadGrant(grant, uploadedBlocks[index], id, actor.email));
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
      grantRefs.forEach((ref) => transaction.delete(ref));
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
  const access = await accessRecord(email);
  if (!access || access.disabled) {
    throw new HttpsError("permission-denied", "This account does not have access to Plan Clarity.");
  }
  if (access.accessRole === "work_items_only") {
    throw new HttpsError("permission-denied", "This account only has access to Work Items.");
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

function cleanOutputString(value, maxLength = 4_000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeAnalysis(raw) {
  const actionItems = Array.isArray(raw.actionItems)
    ? raw.actionItems.map((value) => cleanOutputString(String(value), 1_000)).filter(Boolean).slice(0, 8)
    : [];
  const stakeholders = Array.isArray(raw.stakeholders)
    ? raw.stakeholders.map((value) => cleanOutputString(String(value), 500)).filter(Boolean).slice(0, 8)
    : [];
  const risks = Array.isArray(raw.risks)
    ? raw.risks.map((value) => cleanOutputString(String(value), 1_000)).filter(Boolean).slice(0, 6)
    : [];
  const buyingSignals = Array.isArray(raw.buyingSignals)
    ? raw.buyingSignals.map((value) => cleanOutputString(String(value), 1_000)).filter(Boolean).slice(0, 6)
    : [];
  const nextAction = raw.nextAction && typeof raw.nextAction === "object"
    ? {
        text: cleanOutputString(raw.nextAction.text, 1_000),
        dueDate: cleanOutputString(raw.nextAction.dueDate, 10),
      }
    : null;

  return {
    summary: cleanOutputString(raw.summary),
    customerNeed: cleanOutputString(raw.customerNeed),
    buyingSignals,
    risks,
    actionItems,
    stakeholders,
    nextAction: nextAction?.text ? nextAction : null,
  };
}

export const analyzeMeetTranscript = onCall(
  { region: "us-central1", secrets: [deepseekApiKey], timeoutSeconds: 120, memory: "512MiB", maxInstances: 3 },
  async (request) => {
    await assertAllowed(request);
    const transcript = coerceString(request.data?.transcript, "transcript", 120_000);
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in before analyzing a transcript.");
    await consumeAiQuota(request.auth.uid, transcript.length);
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
        max_tokens: 2_000,
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
      console.error("DeepSeek request failed", { status: response.status });
      throw new HttpsError("unavailable", "Transcript analysis is temporarily unavailable.");
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new HttpsError("internal", "DeepSeek response was missing content.");
    }

    return normalizeAnalysis(parseJsonObject(content));
  },
);
