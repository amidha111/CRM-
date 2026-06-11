import { signInWithPopup, signOut } from "firebase/auth";
import { useState } from "react";
import { auth, googleProvider } from "../firebase";

export function SignIn({ denied }: { denied: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dot-grid flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-[420px] p-8 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gold text-2xl font-extrabold text-navy">
          D
        </span>
        <h1 className="text-3xl font-bold text-ink">Darma Foundry</h1>
        <p className="mt-1 text-sm text-muted">Your pipeline, one next action at a time.</p>

        {denied && (
          <div className="mt-5 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
            This Google account doesn't have access to this workspace.{" "}
            <button className="font-semibold underline" onClick={() => signOut(auth)}>
              Try a different account
            </button>
          </div>
        )}
        {error && (
          <div className="mt-5 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>
        )}

        {!denied && (
          <button
            onClick={handleSignIn}
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2C36.9 40.4 44 35 44 24c0-1.3-.1-2.6-.4-3.9z"/>
            </svg>
            {busy ? "Signing in…" : "Continue with Google"}
          </button>
        )}

        <p className="mt-6 text-xs text-muted">Private workspace. Access is limited to invited accounts.</p>
      </div>
    </div>
  );
}
