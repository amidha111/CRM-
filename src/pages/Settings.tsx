import { useState } from "react";
import { DEMO } from "../firebase";
import { PageHeader } from "../components/pageChrome";
import { PrimaryButton, inputCls } from "../components/ui";
import { useAllowedUsers } from "../lib/hooks";
import { addAllowedUser, isWorkspaceAdmin, normalizeEmail, removeAllowedUser } from "../lib/store";
import { PIcon } from "../components/icons";

export function SettingsPage({
  userName,
  userEmail,
  userUid,
}: {
  userName: string;
  userEmail: string;
  userUid: string;
}) {
  const admin = isWorkspaceAdmin(userEmail);
  const { allowedUsers, error: usersError } = useAllowedUsers(admin);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setBusy("add");
    setError(null);
    setMessage(null);
    try {
      const normalized = normalizeEmail(email);
      await addAllowedUser(normalized, { name: userName, uid: userUid });
      setEmail("");
      setMessage(`${normalized} can now access the CRM.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add user.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(target: string) {
    if (!window.confirm(`Remove CRM access for ${target}?`)) return;
    setBusy(target);
    setError(null);
    setMessage(null);
    try {
      await removeAllowedUser(target);
      setMessage(`${target} no longer has CRM access.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove user.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page-frame">
      <PageHeader icon="sliders" kind="Workspace" title="Settings" meta="Admin controls" />
      <div className="flex max-w-2xl flex-col gap-4">
        <div className="card p-6">
          <h2 className="mb-3 font-mono text-[11px] font-bold uppercase tracking-wide text-muted">Account</h2>
          <p className="text-sm text-ink">
            Signed in as <span className="font-semibold">{userName}</span>
            {userEmail && <span className="text-muted"> ({userEmail})</span>}
            {DEMO && <span className="ml-2 rounded-md border border-gold/40 bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold-deep">demo mode</span>}
          </p>
        </div>
        <div className="card p-6">
          <h2 className="mb-3 font-mono text-[11px] font-bold uppercase tracking-wide text-muted">Workspace Access</h2>
          <p className="text-sm text-ink">
            Owner access is permanently reserved for <span className="font-semibold">amidha111@gmail.com</span>.
            {admin
              ? " Add teammates below; only this owner account can manage access."
              : " Only the owner account can add or remove teammates."}
          </p>

          {admin && (
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className={inputCls}
                  type="email"
                  placeholder="teammate@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <PrimaryButton onClick={handleAdd} disabled={!email.trim() || busy === "add"}>
                  <PIcon name="plus" size={15} sw={2.2} />
                  Add User
                </PrimaryButton>
              </div>

              {(message || error || usersError) && (
                <p className={`text-sm ${error || usersError ? "text-danger" : "text-success"}`}>
                  {error || usersError?.message || message}
                </p>
              )}

              <div className="overflow-hidden rounded-xl border border-line">
                <div className="flex items-center justify-between border-b border-line bg-tone px-4 py-3">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-muted">Allowed users</span>
                  <span className="font-mono text-[11px] text-faint">{allowedUsers.length + 1} TOTAL</span>
                </div>
                <div className="divide-y divide-line-soft bg-paper">
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">amidha111@gmail.com</p>
                      <p className="text-xs text-muted">Owner · cannot be removed</p>
                    </div>
                    <span className="rounded-md border border-gold/40 bg-gold-soft px-2 py-1 text-xs font-semibold text-gold-deep">
                      Admin
                    </span>
                  </div>
                  {allowedUsers.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{u.email}</p>
                        <p className="text-xs text-muted">Member access</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemove(u.email)}
                        disabled={busy === u.email}
                        className="rounded-md px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger-soft disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {allowedUsers.length === 0 && (
                    <p className="px-4 py-3 text-sm text-muted">No teammates added yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="card p-6">
          <h2 className="mb-3 font-mono text-[11px] font-bold uppercase tracking-wide text-muted">Data</h2>
          <p className="text-sm text-ink">
            Firebase project <code className="rounded bg-tone px-1 py-0.5 text-xs">founderflow-crm-af1</code>,
            Firestore collections <code className="rounded bg-tone px-1 py-0.5 text-xs">opportunities</code>,{" "}
            <code className="rounded bg-tone px-1 py-0.5 text-xs">activities</code> (append-only),{" "}
            <code className="rounded bg-tone px-1 py-0.5 text-xs">contacts</code>. Everything runs inside the
            free Spark tier.
          </p>
        </div>
      </div>
    </div>
  );
}
