import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";

// Storage Rules cross-service Firestore lookups use the Firebase CLI project ID.
// Emulators isolate this from production even though the identifier matches.
const PROJECT_ID = "founderflow-crm-af1";
const ADMIN = { uid: "admin-uid", email: "amidha111@gmail.com", email_verified: true };
const ANN = { uid: "ann-uid", email: "lewandowskiannm@gmail.com", email_verified: true };
const RAHUL = { uid: "rahul-uid", email: "rahul@klego.ai", email_verified: true };
const NIKITA = { uid: "nikita-uid", email: "nikita@planclarity.ai", email_verified: true };
const DISABLED = { uid: "disabled-uid", email: "disabled@example.com", email_verified: true };
const UNLISTED = { uid: "stranger-uid", email: "stranger@example.com", email_verified: true };

let env;

function emulatorAddress(name, fallbackPort) {
  const raw = process.env[name] ?? `127.0.0.1:${fallbackPort}`;
  const [host, port] = raw.split(":");
  return { host, port: Number(port) };
}

function authContext(identity) {
  const { uid, ...token } = identity;
  return env.authenticatedContext(uid, { ...token, sub: uid });
}

function workItem(product, referenceId) {
  const now = Timestamp.now();
  return {
    sequenceNumber: Number(referenceId.split("-")[1]),
    referenceId,
    type: "bug",
    product,
    subject: `${product} security fixture`,
    content: [{ id: "text", type: "text", text: "fixture" }],
    videoUrl: null,
    priority: "medium",
    status: "open",
    assigneeEmail: ADMIN.email,
    assigneeName: "Amit Midha",
    createdByEmail: ADMIN.email,
    createdByName: "Amit Midha",
    createdAt: now,
    updatedAt: now,
  };
}

before(async () => {
  const firestore = emulatorAddress("FIRESTORE_EMULATOR_HOST", 8080);
  const storage = emulatorAddress("FIREBASE_STORAGE_EMULATOR_HOST", 9199);
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { ...firestore, rules: await readFile("firestore.rules", "utf8") },
    storage: { ...storage, rules: await readFile("storage.rules", "utf8") },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const now = Timestamp.now();
    await Promise.all([
      setDoc(doc(db, "allowedUsers", ANN.email), {
        email: ANN.email, displayName: "Ann Lewandowski", disabled: false, accessRole: "full",
        workItemProducts: ["plan_clarity"], canAssignWorkItems: false,
        addedBy: ADMIN.uid, addedByName: "Amit Midha", createdAt: now, updatedAt: now,
      }),
      setDoc(doc(db, "allowedUsers", RAHUL.email), {
        email: RAHUL.email, displayName: "Rahul Panchal", disabled: false, accessRole: "work_items_only",
        workItemProducts: ["klego", "plan_clarity"], canAssignWorkItems: true,
        addedBy: ADMIN.uid, addedByName: "Amit Midha", createdAt: now, updatedAt: now,
      }),
      setDoc(doc(db, "allowedUsers", NIKITA.email), {
        email: NIKITA.email, displayName: "Nikita Selmenskih", disabled: false, accessRole: "work_items_only",
        workItemProducts: ["plan_clarity"], canAssignWorkItems: true,
        addedBy: ADMIN.uid, addedByName: "Amit Midha", createdAt: now, updatedAt: now,
      }),
      setDoc(doc(db, "allowedUsers", DISABLED.email), {
        email: DISABLED.email, displayName: "Disabled User", disabled: true, accessRole: "full",
        workItemProducts: ["klego", "plan_clarity"], canAssignWorkItems: false,
        addedBy: ADMIN.uid, addedByName: "Amit Midha", createdAt: now, updatedAt: now,
      }),
      setDoc(doc(db, "accounts", "account-1"), { name: "Fixture", website: null, createdAt: now, updatedAt: now }),
      setDoc(doc(db, "workItems", "plan-item"), {
        ...workItem("plan_clarity", "WI-0001"),
        assigneeEmail: NIKITA.email,
        assigneeName: "Nikita Selmenskih",
      }),
      setDoc(doc(db, "workItems", "klego-item"), workItem("klego", "WI-0002")),
    ]);
    const bypassStorage = context.storage();
    await uploadBytes(ref(bypassStorage, "workItems/plan-item/legacy.png"), new Uint8Array([1, 2, 3]), { contentType: "image/png" });
    await uploadBytes(ref(bypassStorage, "workItems/klego-item/legacy.png"), new Uint8Array([1, 2, 3]), { contentType: "image/png" });
    await uploadBytes(ref(bypassStorage, "workItems/klego-item/admin-delete.png"), new Uint8Array([1]), { contentType: "image/png" });
  });
});

test("Nikita can edit Plan Clarity Work Items with an event but cannot access Klego or sales CRM", async () => {
  const db = authContext(NIKITA).firestore();
  await assertFails(getDoc(doc(db, "accounts", "account-1")));
  await assertSucceeds(getDoc(doc(db, "workItems", "plan-item")));
  await assertFails(getDoc(doc(db, "workItems", "klego-item")));

  const batch = writeBatch(db);
  batch.update(doc(db, "workItems", "plan-item"), { status: "in_progress", updatedAt: serverTimestamp() });
  batch.set(doc(collection(db, "workItems", "plan-item", "events")), {
    kind: "system",
    body: "Updated status from Open to In Progress.",
    actorEmail: NIKITA.email,
    actorName: "Nikita Selmenskih",
    createdAt: serverTimestamp(),
  });
  await assertSucceeds(batch.commit());
});

after(async () => {
  await env?.cleanup();
});

test("anonymous, unlisted, unverified, and disabled users cannot read CRM data", async () => {
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "accounts", "account-1")));
  await assertFails(getDoc(doc(authContext(UNLISTED).firestore(), "accounts", "account-1")));
  await assertFails(getDoc(doc(env.authenticatedContext("raw", { email: ANN.email, email_verified: false }).firestore(), "accounts", "account-1")));
  await assertFails(getDoc(doc(authContext(DISABLED).firestore(), "accounts", "account-1")));
});

test("Ann can use sales CRM and Plan Clarity Work Items but cannot see or convert Klego items", async () => {
  const db = authContext(ANN).firestore();
  await assertSucceeds(getDoc(doc(db, "accounts", "account-1")));
  await assertSucceeds(getDoc(doc(db, "workItems", "plan-item")));
  await assertFails(getDoc(doc(db, "workItems", "klego-item")));
  await assertFails(updateDoc(doc(db, "workItems", "plan-item"), { product: "klego", updatedAt: serverTimestamp() }));
});

test("Rahul can update valid Work Item state but cannot access sales objects or forge immutable IDs", async () => {
  const db = authContext(RAHUL).firestore();
  await assertFails(getDoc(doc(db, "accounts", "account-1")));
  await assertSucceeds(getDoc(doc(db, "workItems", "klego-item")));
  await assertSucceeds(updateDoc(doc(db, "workItems", "klego-item"), { status: "closed", updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db, "workItems", "klego-item"), { referenceId: "WI-9999", updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(db, "workItems", "forged"), workItem("klego", "WI-9999")));
});

test("Work Item events require the real caller identity, bounded content, and server time", async () => {
  const db = authContext(RAHUL).firestore();
  await assertSucceeds(addDoc(collection(db, "workItems", "klego-item", "events"), {
    kind: "comment", body: "Legitimate comment", actorEmail: RAHUL.email,
    actorName: "Rahul Panchal", createdAt: serverTimestamp(),
  }));
  await assertFails(addDoc(collection(db, "workItems", "klego-item", "events"), {
    kind: "system", body: "Forged admin event", actorEmail: ADMIN.email,
    actorName: "Amit Midha", createdAt: serverTimestamp(),
  }));
  await assertFails(addDoc(collection(db, "workItems", "klego-item", "events"), {
    kind: "comment", body: "x".repeat(5001), actorEmail: RAHUL.email,
    actorName: "Rahul Panchal", createdAt: serverTimestamp(),
  }));
});

test("dangerous external URL schemes are rejected at the database boundary", async () => {
  const db = authContext(ANN).firestore();
  await assertFails(setDoc(doc(db, "contacts", "bad-link"), {
    firstName: "Bad", lastName: "Link", name: "Bad Link", accountId: null, accountName: "",
    title: null, email: null, phone: null, linkedinUrl: "javascript:alert(1)", notes: "",
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(db, "accounts", "bad-site"), {
    name: "Bad Site", industry: null, website: "data:text/html,boom", phone: null, notes: "",
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
});

test("only the owner can list/create/remove directory users and browser updates are blocked", async () => {
  const adminDb = authContext(ADMIN).firestore();
  const annDb = authContext(ANN).firestore();
  await assertSucceeds(getDoc(doc(annDb, "allowedUsers", ANN.email)));
  await assertFails(getDoc(doc(annDb, "allowedUsers", RAHUL.email)));
  const newEmail = "new@example.com";
  await assertSucceeds(setDoc(doc(adminDb, "allowedUsers", newEmail), {
    email: newEmail, displayName: "New User", disabled: false, accessRole: "full",
    workItemProducts: ["klego", "plan_clarity"], canAssignWorkItems: false,
    addedBy: ADMIN.uid, addedByName: "Amit Midha", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(adminDb, "allowedUsers", newEmail), { disabled: true, updatedAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(doc(adminDb, "allowedUsers", newEmail)));
});

test("Storage reads follow product access and only the owner can delete", async () => {
  const annStorage = authContext(ANN).storage();
  const rahulStorage = authContext(RAHUL).storage();
  const adminStorage = authContext(ADMIN).storage();
  await assertSucceeds(getBytes(ref(annStorage, "workItems/plan-item/legacy.png")));
  await assertFails(getBytes(ref(annStorage, "workItems/klego-item/legacy.png")));
  await assertSucceeds(getBytes(ref(rahulStorage, "workItems/klego-item/legacy.png")));
  await assertFails(getBytes(ref(authContext(UNLISTED).storage(), "workItems/plan-item/legacy.png")));
  await assertFails(deleteObject(ref(rahulStorage, "workItems/klego-item/admin-delete.png")));
  await assertSucceeds(deleteObject(ref(adminStorage, "workItems/klego-item/admin-delete.png")));
});

test("new Storage uploads require an exact unexpired grant, path, size, and type", async () => {
  const path = "workItems/plan-item/grant-1/screenshot.png";
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "workItemUploadGrants", "grant-1"), {
      uid: ANN.uid, email: ANN.email, workItemId: "plan-item", product: "plan_clarity",
      storagePath: path, fileSize: 4, contentType: "image/png",
      createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
    });
  });
  const storage = authContext(ANN).storage();
  await assertFails(uploadBytes(ref(storage, "workItems/plan-item/no-grant/orphan.png"), new Uint8Array([1]), { contentType: "image/png" }));
  await assertFails(uploadBytes(ref(storage, "workItems/plan-item/grant-1/other.png"), new Uint8Array([1, 2, 3, 4]), { contentType: "image/png" }));
  await assertFails(uploadBytes(ref(storage, path), new Uint8Array([1, 2, 3]), { contentType: "image/png" }));
  await assertSucceeds(uploadBytes(ref(storage, path), new Uint8Array([1, 2, 3, 4]), { contentType: "image/png" }));
  assert.equal((await getBytes(ref(storage, path))).byteLength, 4);
});

test("Storage grants accept supported Work Item files and reject unsafe types", async () => {
  const pdfPath = "workItems/plan-item/grant-pdf/specification.pdf";
  const htmlPath = "workItems/plan-item/grant-html/page.html";
  await env.withSecurityRulesDisabled(async (context) => {
    await Promise.all([
      setDoc(doc(context.firestore(), "workItemUploadGrants", "grant-pdf"), {
        uid: ANN.uid, email: ANN.email, workItemId: "plan-item", product: "plan_clarity",
        storagePath: pdfPath, fileSize: 4, contentType: "application/pdf", blockType: "file",
        createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
      }),
      setDoc(doc(context.firestore(), "workItemUploadGrants", "grant-html"), {
        uid: ANN.uid, email: ANN.email, workItemId: "plan-item", product: "plan_clarity",
        storagePath: htmlPath, fileSize: 4, contentType: "text/html", blockType: "file",
        createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
      }),
    ]);
  });
  const storage = authContext(ANN).storage();
  await assertSucceeds(uploadBytes(ref(storage, pdfPath), new Uint8Array([1, 2, 3, 4]), { contentType: "application/pdf" }));
  await assertFails(uploadBytes(ref(storage, htmlPath), new Uint8Array([1, 2, 3, 4]), { contentType: "text/html" }));
});
