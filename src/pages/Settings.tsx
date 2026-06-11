import { DEMO } from "../firebase";

export function SettingsPage({ userName, userEmail }: { userName: string; userEmail: string }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 px-8 py-4 backdrop-blur">
        <h1 className="text-2xl font-bold text-ink">Settings</h1>
      </header>
      <div className="flex max-w-2xl flex-col gap-6 p-8">
        <div className="card p-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Account</h2>
          <p className="text-sm text-ink">
            Signed in as <span className="font-semibold">{userName}</span>
            {userEmail && <span className="text-muted"> ({userEmail})</span>}
            {DEMO && <span className="ml-2 rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold-deep">demo mode</span>}
          </p>
        </div>
        <div className="card p-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Workspace Access</h2>
          <p className="text-sm text-ink">
            Access is controlled by an email allowlist in the Firestore security rules
            (<code className="rounded bg-slate-100 px-1 py-0.5 text-xs">firestore.rules</code>). Adding a teammate
            is a one-line change and redeploy:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-navy p-4 text-xs text-white/90">
{`request.auth.token.email in [
  'amidha111@gmail.com',
  'teammate@example.com'   // add here
]`}
          </pre>
          <p className="mt-2 text-xs text-muted">Then: firebase deploy --only firestore:rules</p>
        </div>
        <div className="card p-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Data</h2>
          <p className="text-sm text-ink">
            Firebase project <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">founderflow-crm-af1</code>,
            Firestore collections <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">opportunities</code>,{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">activities</code> (append-only),{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">contacts</code>. Everything runs inside the
            free Spark tier.
          </p>
        </div>
      </div>
    </div>
  );
}
