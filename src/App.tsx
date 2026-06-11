import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth, DEMO } from "./firebase";
import { useAccounts, useActivities, useContacts, useOpportunities } from "./lib/hooks";
import type { Actor } from "./types";
import { Sidebar, type Page } from "./components/Sidebar";
import { SignIn } from "./components/SignIn";
import { OpportunitiesPage } from "./pages/Opportunities";
import { AccountsPage } from "./pages/Accounts";
import { ContactsPage } from "./pages/Contacts";
import { ActivityLogPage } from "./pages/ActivityLog";
import { DashboardPage } from "./pages/Dashboard";
import { SettingsPage } from "./pages/Settings";

function isPermissionDenied(e: Error | null): boolean {
  return !!e && /permission|insufficient/i.test(e.message);
}

function Workspace({ user }: { user: { name: string; email: string; uid: string } }) {
  const [page, setPage] = useState<Page>("opportunities");
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);
  const { opps, error: oppError } = useOpportunities();
  const { activities } = useActivities();
  const { contacts } = useContacts();
  const { accounts } = useAccounts();

  const actor: Actor = useMemo(() => ({ name: user.name, uid: user.uid }), [user]);

  const owners = useMemo(() => {
    const names = new Set<string>([user.name]);
    (opps ?? []).forEach((o) => names.add(o.owner));
    return [...names];
  }, [opps, user.name]);

  if (isPermissionDenied(oppError)) {
    return <SignIn denied />;
  }

  if (!opps || !activities || !contacts || !accounts) {
    return (
      <div className="dot-grid flex min-h-screen items-center justify-center">
        <p className="text-muted">Loading workspace…</p>
      </div>
    );
  }

  function openOpp(id: string) {
    setSelectedOppId(id);
    setPage("opportunities");
  }

  return (
    <div className="dot-grid flex h-screen overflow-hidden">
      <Sidebar page={page} onNavigate={setPage} userName={user.name} onSignOut={() => !DEMO && signOut(auth)} />
      {page === "opportunities" && (
        <OpportunitiesPage
          opps={opps}
          activities={activities}
          contacts={contacts}
          accounts={accounts}
          actor={actor}
          owners={owners}
          selectedId={selectedOppId}
          onSelect={setSelectedOppId}
        />
      )}
      {page === "accounts" && (
        <AccountsPage
          accounts={accounts}
          opps={opps}
          contacts={contacts}
          actor={actor}
          owners={owners}
          onOpenOpp={openOpp}
        />
      )}
      {page === "contacts" && (
        <ContactsPage
          contacts={contacts}
          accounts={accounts}
          opps={opps}
          activities={activities}
          onOpenOpp={openOpp}
        />
      )}
      {page === "activity" && <ActivityLogPage activities={activities} opps={opps} onOpenOpp={openOpp} />}
      {page === "dashboard" && <DashboardPage opps={opps} actor={actor} onOpenOpp={openOpp} />}
      {page === "settings" && <SettingsPage userName={user.name} userEmail={user.email} />}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null | "loading">(DEMO ? null : "loading");

  useEffect(() => {
    if (DEMO) return;
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  if (DEMO) {
    return <Workspace user={{ name: "Amit", email: "demo@founderflow.local", uid: "demo" }} />;
  }

  if (user === "loading") {
    return (
      <div className="dot-grid flex min-h-screen items-center justify-center">
        <p className="text-muted">…</p>
      </div>
    );
  }

  if (!user) {
    return <SignIn denied={false} />;
  }

  return (
    <Workspace
      user={{
        name: user.displayName ?? user.email ?? "User",
        email: user.email ?? "",
        uid: user.uid,
      }}
    />
  );
}
