import { useEffect, useMemo, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, DEMO, functions } from "../firebase";
import { PageHeader } from "../components/pageChrome";
import { Field, GhostButton, Modal, PrimaryButton, inputCls } from "../components/ui";
import { useAllowedUsers } from "../lib/hooks";
import { addAllowedUser, isWorkspaceAdmin, normalizeEmail, removeAllowedUser } from "../lib/store";
import { PIcon } from "../components/icons";
import type { AllowedUser, WorkItemProduct, WorkspaceUsage } from "../types";

type SettingsTab = "users" | "storage";
type PreviewTarget = {
  name: string;
  email: string;
  accessRole: "full" | "work_items_only";
  workItemProducts: WorkItemProduct[];
};

function roleLabel(user: AllowedUser) {
  if (user.accessRole === "work_items_only") return "Work Items only";
  if (!user.workItemProducts.includes("klego")) return "Full CRM · Plan Clarity Work Items";
  return "Full CRM";
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unit;
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);
}

function billingStatusText(usage: WorkspaceUsage): string {
  if (usage.billingExportStatus === "ready") {
    return usage.billingDataThrough
      ? `Google data through ${new Date(usage.billingDataThrough).toLocaleString()}`
      : "Live Cloud Billing export";
  }
  if (usage.billingExportStatus === "waiting") return "Waiting for Google to create the export table";
  if (usage.billingExportStatus === "unavailable") return "Billing export could not be read right now";
  return "Cloud Billing export is not connected";
}

function UserEditor({
  user,
  busy,
  onClose,
  onSave,
  onRemove,
}: {
  user: AllowedUser;
  busy: boolean;
  onClose: () => void;
  onSave: (input: { displayName: string; email: string; disabled: boolean }) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email);
  const [disabled, setDisabled] = useState(user.disabled);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!displayName.trim()) return setError("Enter the user's full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter a valid access email.");
    try {
      await onSave({ displayName: displayName.trim(), email: normalizeEmail(email), disabled });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update this user.");
    }
  }

  return <Modal title="Edit CRM User" subtitle="Update this person's directory record and login access." onClose={onClose} width={600}>
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required><input className={inputCls} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></Field>
        <Field label="Access email" required><input className={inputCls} type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
      </div>
      <div className="rounded-xl border border-line bg-tone p-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-muted">Access role</p>
        <p className="mt-1 text-sm font-semibold text-ink">{roleLabel(user)}</p>
        <p className="mt-1 text-xs text-muted">The role and product restrictions stay attached when the email changes.</p>
      </div>
      <label className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
        <span><span className="block text-sm font-semibold text-ink">Disable login</span><span className="block text-xs text-muted">Blocks CRM access without deleting the user record.</span></span>
        <input type="checkbox" checked={disabled} onChange={(event) => setDisabled(event.target.checked)} className="h-5 w-5 accent-[#b78b24]" />
      </label>
      {error && <p className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-4">
        <button type="button" onClick={() => void onRemove()} disabled={busy} className="rounded-md px-3 py-2 text-sm font-semibold text-danger hover:bg-danger-soft disabled:opacity-50">Remove user</button>
        <span className="min-w-0 flex-1" />
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save User"}</PrimaryButton>
      </div>
    </div>
  </Modal>;
}

export function SettingsPage({
  userName,
  userEmail,
  userUid,
  onLoginAs,
}: {
  userName: string;
  userEmail: string;
  userUid: string;
  onLoginAs?: (user: PreviewTarget) => void;
}) {
  const admin = isWorkspaceAdmin(userEmail);
  const { allowedUsers, error: usersError } = useAllowedUsers(admin);
  const [tab, setTab] = useState<SettingsTab>("users");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [selected, setSelected] = useState<AllowedUser | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<WorkspaceUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);

  const activeCount = allowedUsers.filter((user) => !user.disabled).length + 1;
  const disabledCount = allowedUsers.filter((user) => user.disabled).length;
  const totalRecords = useMemo(() => Object.values(usage?.recordCounts ?? {}).reduce((sum, count) => sum + count, 0), [usage]);

  async function loadUsage() {
    setUsageLoading(true);
    setUsageError(null);
    try {
      const response = await httpsCallable<undefined, Omit<WorkspaceUsage, "measuredAt" | "files"> & { measuredAt: string; files: Array<Omit<WorkspaceUsage["files"][number], "updatedAt"> & { updatedAt: string | null }> }>(functions, "getWorkspaceUsage")();
      setUsage({
        ...response.data,
        measuredAt: new Date(response.data.measuredAt),
        files: response.data.files.map((file) => ({ ...file, updatedAt: file.updatedAt ? new Date(file.updatedAt) : null })),
      });
    } catch (reason) {
      setUsageError(reason instanceof Error ? reason.message : "Unable to measure workspace usage.");
    } finally {
      setUsageLoading(false);
    }
  }

  async function deleteFile(storagePath: string) {
    if (!window.confirm(`Permanently delete ${storagePath}? It will also be removed from any linked Work Item record.`)) return;
    setBusy(`file:${storagePath}`);
    setUsageError(null);
    try {
      const response = await httpsCallable<{ storagePath: string }, { updatedWorkItems: number; deletedFirestoreRecords: number }>(functions, "deleteWorkspaceFile")({ storagePath });
      await loadUsage();
      setMessage(`File deleted from Firebase Storage and removed from ${response.data.deletedFirestoreRecords} Firestore record${response.data.deletedFirestoreRecords === 1 ? "" : "s"}.`);
    } catch (reason) {
      setUsageError(reason instanceof Error ? reason.message : "Unable to delete this file.");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (admin && tab === "storage" && !usage && !usageLoading) void loadUsage();
  }, [admin, tab, usage, usageLoading]);

  async function handleAdd() {
    setBusy("add"); setError(null); setMessage(null);
    try {
      await addAllowedUser(newEmail, newName, { name: userName, uid: userUid });
      setNewEmail(""); setNewName(""); setMessage(`${newName.trim()} can now access the CRM.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to add user.");
    } finally { setBusy(null); }
  }

  async function updateUser(target: AllowedUser, input: { displayName: string; email: string; disabled: boolean }) {
    setBusy(target.email); setError(null); setMessage(null);
    try {
      const response = await httpsCallable(functions, "updateWorkspaceUser")({ currentEmail: target.email, ...input });
      void response;
      setSelected(null);
      setMessage(`${input.displayName}'s user record was updated.`);
    } finally { setBusy(null); }
  }

  async function handleRemove(target: AllowedUser) {
    if (!window.confirm(`Remove CRM access for ${target.displayName}? This deletes the directory record.`)) return;
    setBusy(target.email); setError(null); setMessage(null);
    try {
      await removeAllowedUser(target.email);
      setSelected(null);
      setMessage(`${target.displayName} no longer has CRM access.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to remove user.");
    } finally { setBusy(null); }
  }

  async function toggleDisabled(target: AllowedUser) {
    try {
      await updateUser(target, { displayName: target.displayName, email: target.email, disabled: !target.disabled });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to change this user's status.");
    }
  }

  async function sendReset(target: AllowedUser) {
    setBusy(`reset:${target.email}`); setError(null); setMessage(null);
    try {
      await httpsCallable(functions, "preparePasswordUser")({ email: target.email });
      await sendPasswordResetEmail(auth, target.email);
      setMessage(`Password reset email sent to ${target.email}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send the reset email.");
    } finally { setBusy(null); }
  }

  return <div className="page-frame">
    <PageHeader icon="sliders" kind="Workspace" title="Settings" meta="Users, access, and storage" />
    <div className="mb-4 flex gap-1 rounded-xl border border-line bg-paper p-1">
      {(["users", "storage"] as SettingsTab[]).map((key) => <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === key ? "bg-navy text-white" : "text-muted hover:bg-tone hover:text-ink"}`}>{key === "users" ? "Users" : "Storage Usage"}</button>)}
    </div>

    {tab === "users" && <div className="flex flex-col gap-4">
      <div className="card p-5"><p className="text-sm text-ink">Signed in as <b>{userName}</b> <span className="text-muted">({userEmail})</span>{DEMO && " · demo mode"}</p></div>
      {!admin ? <div className="card p-6 text-sm text-muted">Only Amit Midha can manage workspace users.</div> : <>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="card p-4"><p className="page-kind">Total users</p><p className="mt-1 text-2xl font-bold">{allowedUsers.length + 1}</p></div>
          <div className="card p-4"><p className="page-kind">Active</p><p className="mt-1 text-2xl font-bold text-success">{activeCount}</p></div>
          <div className="card p-4"><p className="page-kind">Disabled</p><p className="mt-1 text-2xl font-bold text-muted">{disabledCount}</p></div>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold text-ink">Add CRM user</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1.2fr_auto]">
            <input className={inputCls} placeholder="Full name" value={newName} onChange={(event) => setNewName(event.target.value)} />
            <input className={inputCls} type="email" placeholder="teammate@example.com" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} />
            <PrimaryButton onClick={handleAdd} disabled={!newName.trim() || !newEmail.trim() || busy === "add"}><PIcon name="plus" size={15} />Add User</PrimaryButton>
          </div>
        </div>
        {(message || error || usersError) && <p className={`rounded-lg px-4 py-3 text-sm ${error || usersError ? "bg-danger-soft text-danger" : "bg-success-soft text-success"}`}>{error || usersError?.message || message}</p>}
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead><tr className="border-b border-line bg-tone/70 text-left font-mono text-[11px] uppercase tracking-wide text-muted"><th className="px-5 py-3.5">User</th><th className="px-3 py-3.5">Access</th><th className="px-3 py-3.5">Status</th><th className="px-5 py-3.5 text-right">Actions</th></tr></thead>
            <tbody>
              <tr className="border-b border-line-soft"><td className="px-5 py-4"><b>Amit Midha</b><span className="block text-xs text-muted">amidha111@gmail.com</span></td><td className="px-3 py-4">Admin · Full CRM</td><td className="px-3 py-4"><span className="rounded-full bg-success-soft px-2 py-1 text-xs font-semibold text-success">Active</span></td><td className="px-5 py-4 text-right text-xs text-muted">Protected owner</td></tr>
              {allowedUsers.map((target) => <tr key={target.id} onClick={() => setSelected(target)} className="cursor-pointer border-b border-line-soft last:border-0 hover:bg-gold-soft/30"><td className="px-5 py-4"><b>{target.displayName}</b><span className="block text-xs text-muted">{target.email}</span></td><td className="px-3 py-4 text-muted">{roleLabel(target)}</td><td className="px-3 py-4"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${target.disabled ? "bg-tone text-muted" : "bg-success-soft text-success"}`}>{target.disabled ? "Disabled" : "Active"}</span></td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" disabled={target.disabled} onClick={(event) => { event.stopPropagation(); onLoginAs?.({ name: target.displayName, email: target.email, accessRole: target.accessRole, workItemProducts: target.workItemProducts }); }} className="toolbar-button disabled:opacity-40">Login As</button>{target.accessRole === "work_items_only" && <button type="button" onClick={(event) => { event.stopPropagation(); void sendReset(target); }} className="toolbar-button">Reset password</button>}<button type="button" onClick={(event) => { event.stopPropagation(); void toggleDisabled(target); }} className="toolbar-button">{target.disabled ? "Enable" : "Disable"}</button><button type="button" onClick={(event) => { event.stopPropagation(); setSelected(target); }} className="toolbar-button">Edit</button></div></td></tr>)}
            </tbody>
          </table>
        </div>
      </>}
    </div>}

    {tab === "storage" && <div className="flex flex-col gap-4">
      {!admin ? <div className="card p-6 text-sm text-muted">Only Amit Midha can view workspace usage.</div> : <>
        <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-ink">Storage & Google Cost</h2><p className="text-sm text-muted">Live Firebase files, Firestore records, and current storage-cost visibility.</p></div><button type="button" className="toolbar-button" onClick={() => void loadUsage()} disabled={usageLoading}><PIcon name="refresh" size={14} />{usageLoading ? "Measuring…" : "Refresh"}</button></div>
        {message && <p className="rounded-lg bg-success-soft px-4 py-3 text-sm text-success">{message}</p>}
        {usageError && <p className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{usageError}</p>}
        {!usage && usageLoading ? <div className="card p-10 text-center text-muted">Measuring file storage…</div> : usage && <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><div className="card border-gold/30 bg-gold-soft/30 p-5"><p className="page-kind">Google cost this month</p><p className="mt-1 text-3xl font-bold text-ink">{usage.actualGoogleCostUsd === null ? "—" : formatUsd(usage.actualGoogleCostUsd)}</p><p className="mt-1 text-xs text-muted">{billingStatusText(usage)}</p></div><div className="card p-5"><p className="page-kind">File storage used</p><p className="mt-1 text-3xl font-bold text-ink">{formatBytes(usage.storageBytes)}</p></div><div className="card p-5"><p className="page-kind">Firestore data estimate</p><p className="mt-1 text-3xl font-bold text-ink">{formatBytes(usage.firestoreEstimatedBytes)}</p></div><div className="card p-5"><p className="page-kind">CRM records</p><p className="mt-1 text-3xl font-bold text-ink">{totalRecords}</p></div><div className="card p-5"><p className="page-kind">Estimated storage charge</p><p className="mt-1 text-3xl font-bold text-success">{formatUsd(usage.estimatedStorageCostUsd)}</p><p className="mt-1 text-xs text-muted">per month at current size</p></div></div>
          <div className="card border-gold/30 bg-gold-soft/30 p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h3 className="font-semibold text-ink">Actual Google Cloud usage cost</h3><p className="mt-1 max-w-3xl text-sm text-muted">{usage.billingExportStatus === "ready" ? <>This month: <b>{formatUsd(usage.actualGoogleCostUsd ?? 0)}</b>. Previous month: <b>{formatUsd(usage.previousMonthGoogleCostUsd ?? 0)}</b>. These are net project usage costs after credits from Google&apos;s billing export; invoice-level tax or adjustments may differ.</> : <>The secure billing dataset exists, but Google&apos;s Standard usage cost export still needs to be connected or finish its first load. Until then, the CRM deliberately shows a dash instead of a false zero.</>}</p></div><div className="flex flex-wrap gap-2"><a href={usage.billingExportUrl} target="_blank" rel="noreferrer" className="toolbar-button whitespace-nowrap">Configure export</a><a href={usage.billingReportUrl} target="_blank" rel="noreferrer" className="toolbar-button whitespace-nowrap">Open Google Billing</a></div></div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5"><h3 className="font-semibold text-ink">File storage breakdown</h3><div className="mt-4 divide-y divide-line-soft">{usage.storageBreakdown.length ? usage.storageBreakdown.map((entry) => <div key={entry.label} className="flex items-center justify-between py-3"><span><b className="block text-sm">{entry.label}</b><span className="text-xs text-muted">{entry.fileCount} file{entry.fileCount === 1 ? "" : "s"}</span></span><b>{formatBytes(entry.bytes)}</b></div>) : <p className="py-6 text-sm text-muted">No uploaded files are consuming storage.</p>}</div></div>
            <div className="card p-5"><h3 className="font-semibold text-ink">Firestore record counts</h3><div className="mt-4 divide-y divide-line-soft">{Object.entries(usage.recordCounts).map(([name, count]) => <div key={name} className="flex items-center justify-between py-2.5"><code className="text-xs text-muted">{name}</code><b>{count}</b></div>)}</div></div>
          </div>
          <div className="card overflow-x-auto">
            <div className="border-b border-line px-5 py-4"><h3 className="font-semibold text-ink">Stored files</h3><p className="mt-1 text-xs text-muted">Deleting a file also removes its image block from every linked Work Item in Firestore.</p></div>
            {usage.files.length ? <table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b border-line bg-tone/70 text-left font-mono text-[11px] uppercase tracking-wide text-muted"><th className="px-5 py-3">File</th><th className="px-3 py-3">Linked record</th><th className="px-3 py-3">Size</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody>{usage.files.map((file) => <tr key={file.name} className="border-b border-line-soft last:border-0"><td className="px-5 py-4"><b className="block max-w-md truncate" title={file.name}>{file.name.split("/").at(-1)}</b><span className="block max-w-md truncate text-xs text-muted" title={file.name}>{file.name}</span></td><td className="px-3 py-4 text-muted">{file.linkedWorkItems.length ? file.linkedWorkItems.map((item) => `${item.referenceId} · ${item.subject}`).join(", ") : "Not linked"}</td><td className="px-3 py-4 font-semibold">{formatBytes(file.bytes)}</td><td className="px-5 py-4 text-right"><button type="button" onClick={() => void deleteFile(file.name)} disabled={busy === `file:${file.name}`} className="rounded-md px-3 py-2 text-sm font-semibold text-danger hover:bg-danger-soft disabled:opacity-50">{busy === `file:${file.name}` ? "Deleting…" : "Delete"}</button></td></tr>)}</tbody></table> : <p className="px-5 py-8 text-sm text-muted">No uploaded files are consuming storage.</p>}
          </div>
          <p className="text-xs text-muted">Measured {usage.measuredAt.toLocaleString()}. File totals come from Firebase Storage object metadata; Firestore counts are records, not byte estimates.</p>
        </>}
      </>}
    </div>}

    {selected && <UserEditor user={selected} busy={busy === selected.email} onClose={() => setSelected(null)} onSave={(input) => updateUser(selected, input)} onRemove={() => handleRemove(selected)} />}
  </div>;
}
