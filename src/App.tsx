import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth, DEMO } from "./firebase";
import { useAccounts, useActivities, useContacts, useOpportunities } from "./lib/hooks";
import type { Actor } from "./types";
import { Sidebar, type Page } from "./components/Sidebar";
import { SignIn } from "./components/SignIn";
import type { OpenRecord } from "./components/record";
import { OpportunitiesPage } from "./pages/Opportunities";
import { AccountsPage } from "./pages/Accounts";
import { ContactsPage } from "./pages/Contacts";
import { ActivityLogPage } from "./pages/ActivityLog";
import { DashboardPage } from "./pages/Dashboard";
import { SettingsPage } from "./pages/Settings";
import { OpportunityRecordPage } from "./pages/OpportunityRecord";
import { AccountRecordPage } from "./pages/AccountRecord";
import { ContactRecordPage } from "./pages/ContactRecord";

function isPermissionDenied(e: Error | null): boolean {
  return !!e && /permission|insufficient/i.test(e.message);
}

type RecordRef = { type: "opportunity" | "account" | "contact"; id: string };

const RECORD_HOME: Record<RecordRef["type"], Page> = {
  opportunity: "opportunities",
  account: "accounts",
  contact: "contacts",
};

function Workspace({ user }: { user: { name: string; email: string; uid: string } }) {
  const [page, setPage] = useState<Page>("dashboard");
  const [record, setRecord] = useState<RecordRef | null>(null);
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

  function navigate(p: Page) {
    setPage(p);
    setRecord(null);
  }

  const openRecord: OpenRecord = (type, id) => {
    setPage(RECORD_HOME[type]);
    setRecord({ type, id });
  };

  function renderRecord(ref: RecordRef) {
    const backToList = () => setRecord(null);
    if (ref.type === "opportunity") {
      const opp = opps!.find((o) => o.id === ref.id);
      if (!opp) return null;
      return (
        <OpportunityRecordPage
          opp={opp}
          activities={activities!}
          contacts={contacts!}
          accounts={accounts!}
          opps={opps!}
          actor={actor}
          owners={owners}
          onBack={backToList}
          onOpenRecord={openRecord}
        />
      );
    }
    if (ref.type === "account") {
      const account = accounts!.find((a) => a.id === ref.id);
      if (!account) return null;
      return (
        <AccountRecordPage
          account={account}
          opps={opps!}
          contacts={contacts!}
          accounts={accounts!}
          actor={actor}
          owners={owners}
          onBack={backToList}
          onOpenRecord={openRecord}
        />
      );
    }
    const contact = contacts!.find((c) => c.id === ref.id);
    if (!contact) return null;
    return (
      <ContactRecordPage
        contact={contact}
        opps={opps!}
        activities={activities!}
        accounts={accounts!}
        onBack={backToList}
        onOpenRecord={openRecord}
      />
    );
  }

  const recordView = record ? renderRecord(record) : null;

  return (
    <div className="dot-grid flex h-screen flex-col overflow-hidden">
      <Sidebar page={page} onNavigate={navigate} userName={user.name} onSignOut={() => !DEMO && signOut(auth)} />
      {recordView ?? (
        <>
          {page === "opportunities" && (
            <OpportunitiesPage
              opps={opps}
              contacts={contacts}
              accounts={accounts}
              actor={actor}
              owners={owners}
              onOpenRecord={openRecord}
            />
          )}
          {page === "accounts" && (
            <AccountsPage accounts={accounts} opps={opps} contacts={contacts} onOpenRecord={openRecord} />
          )}
          {page === "contacts" && (
            <ContactsPage contacts={contacts} accounts={accounts} opps={opps} onOpenRecord={openRecord} />
          )}
          {page === "activity" && (
            <ActivityLogPage activities={activities} opps={opps} onOpenOpp={(id) => openRecord("opportunity", id)} />
          )}
          {page === "dashboard" && (
            <DashboardPage opps={opps} actor={actor} onOpenOpp={(id) => openRecord("opportunity", id)} />
          )}
          {page === "settings" && <SettingsPage userName={user.name} userEmail={user.email} userUid={user.uid} />}
        </>
      )}
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
