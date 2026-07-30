import { useEffect, useMemo, useState, type ReactNode, type SyntheticEvent } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth, DEMO } from "./firebase";
import { useAccessRecord, useAccounts, useActivities, useContacts, useOpportunities } from "./lib/hooks";
import type { Actor, WorkItemProduct } from "./types";
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
import { WorkItemsPage } from "./pages/WorkItems";
import { WorkItemRecordPage } from "./pages/WorkItemRecord";
import { useWorkItemAssignees, useWorkItems } from "./lib/workItemHooks";
import { recordPath, recordRouteFromPath, type RecordRoute, type RouteRecordType } from "./lib/recordRoutes";

function isPermissionDenied(e: Error | null): boolean {
  return !!e && /permission|insufficient/i.test(e.message);
}

type RecordRef = { type: "opportunity" | "account" | "contact"; id: string };

const RECORD_HOME: Record<RecordRef["type"], Page> = {
  opportunity: "opportunities",
  account: "accounts",
  contact: "contacts",
};

type WorkspaceUser = { name: string; email: string; uid: string };
type PreviewUser = {
  name: string;
  email: string;
  accessRole: "full" | "work_items_only";
  workItemProducts: WorkItemProduct[];
};

function ReadOnlyPreview({ user, onExit, children }: { user: PreviewUser; onExit: () => void; children: ReactNode }) {
  function blockInteractiveEvent(event: SyntheticEvent) {
    const target = event.target as Element;
    if (target.closest("[data-preview-allow]")) return;
    if (target.closest("button, a, input, select, textarea, form")) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  return <div
    onClickCapture={blockInteractiveEvent}
    onChangeCapture={blockInteractiveEvent}
    onSubmitCapture={blockInteractiveEvent}
  >
    <div className="fixed inset-x-0 bottom-4 z-[200] mx-auto flex w-[min(94vw,720px)] items-center gap-3 rounded-xl border border-gold/50 bg-navy px-4 py-3 text-white shadow-2xl">
      <span className="min-w-0 flex-1 text-sm"><b>Read-only Login As:</b> {user.name} ({user.email}) · changes are blocked</span>
      <button data-preview-allow type="button" onClick={onExit} className="shrink-0 rounded-md bg-white px-3 py-1.5 text-xs font-bold text-navy">Exit preview</button>
    </div>
    {children}
  </div>;
}

function useRecordRoute() {
  const [route, setRoute] = useState<RecordRoute | null>(() => recordRouteFromPath(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => setRoute(recordRouteFromPath(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function open(type: RouteRecordType, referenceId: string) {
    window.history.pushState({}, "", recordPath(type, referenceId));
    setRoute({ type, referenceId });
  }

  function close() {
    if (recordRouteFromPath(window.location.pathname)) {
      window.history.pushState({}, "", "/");
    }
    setRoute(null);
  }

  return { route, open, close };
}

function RecordRouteUnavailable({ onBack }: { onBack: () => void }) {
  return <main className="page-frame">
    <div className="card mx-auto mt-10 max-w-xl p-8 text-center">
      <h1 className="text-xl font-bold text-ink">Record unavailable</h1>
      <p className="mt-2 text-sm leading-6 text-muted">This link does not exist, or your signed-in account does not have access to this record.</p>
      <button type="button" className="toolbar-button mx-auto mt-5" onClick={onBack}>Back to CRM</button>
    </div>
  </main>;
}

function FullWorkspace({ user, planClarityWorkItemsOnly = false, onLoginAs }: { user: WorkspaceUser; planClarityWorkItemsOnly?: boolean; onLoginAs?: (user: PreviewUser) => void }) {
  const allowedWorkItemProducts = planClarityWorkItemsOnly ? (["plan_clarity"] as const) : (["klego", "plan_clarity"] as const);
  const recordRoute = useRecordRoute();
  const [page, setPage] = useState<Page>(() => {
    const type = recordRoute.route?.type;
    return type === "workItem" ? "workItems" : type ? RECORD_HOME[type] : "dashboard";
  });
  const { opps, error: oppError } = useOpportunities();
  const { activities } = useActivities();
  const { contacts } = useContacts();
  const { accounts } = useAccounts();
  const { items: workItems, error: workItemsError } = useWorkItems(planClarityWorkItemsOnly ? "plan_clarity" : undefined);
  const { assignees, error: assigneesError } = useWorkItemAssignees();

  const actor: Actor = useMemo(() => ({ name: user.name, uid: user.uid }), [user]);

  const owners = useMemo(() => {
    const names = new Set<string>([user.name]);
    (opps ?? []).forEach((o) => names.add(o.owner));
    return [...names];
  }, [opps, user.name]);

  useEffect(() => {
    const type = recordRoute.route?.type;
    if (!type) return;
    setPage(type === "workItem" ? "workItems" : RECORD_HOME[type]);
  }, [recordRoute.route]);

  if (isPermissionDenied(oppError) || isPermissionDenied(workItemsError) || isPermissionDenied(assigneesError)) {
    return <SignIn denied />;
  }

  if (!opps || !activities || !contacts || !accounts || !workItems || !assignees) {
    return (
      <div className="dot-grid flex min-h-screen items-center justify-center">
        <p className="text-muted">Loading workspace…</p>
      </div>
    );
  }

  function navigate(p: Page) {
    setPage(p);
    recordRoute.close();
  }

  const openRecord: OpenRecord = (type, id) => {
    const records = type === "opportunity" ? opps : type === "account" ? accounts : contacts;
    const referenceId = records.find((candidate) => candidate.id === id)?.referenceId;
    if (!referenceId) return;
    setPage(RECORD_HOME[type]);
    recordRoute.open(type, referenceId);
  };

  function renderRecord(ref: RecordRef) {
    const backToList = recordRoute.close;
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

  const coreRoute = recordRoute.route && recordRoute.route.type !== "workItem" ? recordRoute.route : null;
  const routedRecord: RecordRef | null = coreRoute
    ? (() => {
        const type = coreRoute.type as RecordRef["type"];
        const records = type === "opportunity" ? opps : type === "account" ? accounts : contacts;
        const match = records.find((candidate) => candidate.referenceId === coreRoute.referenceId);
        return match ? { type, id: match.id } : null;
      })()
    : null;
  const recordView = routedRecord ? renderRecord(routedRecord) : null;
  const workItem = recordRoute.route?.type === "workItem"
    ? workItems.find((item) => item.referenceId === recordRoute.route?.referenceId)
    : null;
  const workItemView = workItem ? <WorkItemRecordPage item={workItem} actor={actor} actorEmail={user.email} allowedProducts={[...allowedWorkItemProducts]} assignees={assignees} onBack={recordRoute.close} /> : null;
  const invalidRoute = !!recordRoute.route && !recordView && !workItemView;

  return (
    <div className="dot-grid flex h-screen flex-col overflow-hidden">
      <Sidebar page={page} onNavigate={navigate} userName={user.name} userKey={user.email} onSignOut={() => !DEMO && signOut(auth)} />
      {recordView ?? workItemView ?? (invalidRoute ? <RecordRouteUnavailable onBack={recordRoute.close} /> : (
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
          {page === "workItems" && <WorkItemsPage items={workItems} actor={actor} actorEmail={user.email} allowedProducts={[...allowedWorkItemProducts]} assignees={assignees} onOpen={(item) => recordRoute.open("workItem", item.referenceId)} />}
          {page === "settings" && <SettingsPage userName={user.name} userEmail={user.email} userUid={user.uid} onLoginAs={onLoginAs} />}
        </>
      ))}
    </div>
  );
}

function WorkItemsOnlyWorkspace({ user, planClarityOnly = false }: { user: WorkspaceUser; planClarityOnly?: boolean }) {
  const allowedProducts = planClarityOnly ? (["plan_clarity"] as const) : (["klego", "plan_clarity"] as const);
  const { items, error } = useWorkItems(planClarityOnly ? "plan_clarity" : undefined);
  const { assignees, error: assigneesError } = useWorkItemAssignees();
  const recordRoute = useRecordRoute();
  const actor: Actor = useMemo(() => ({ name: user.name, uid: user.uid }), [user]);
  if (isPermissionDenied(error) || isPermissionDenied(assigneesError)) return <SignIn denied />;
  if (!items || !assignees) return <div className="dot-grid flex min-h-screen items-center justify-center"><p className="text-muted">Loading work items…</p></div>;
  const workItemReference = recordRoute.route?.type === "workItem" ? recordRoute.route.referenceId : null;
  const item = workItemReference ? items.find((candidate) => candidate.referenceId === workItemReference) : null;
  return <div className="dot-grid flex h-screen flex-col overflow-hidden">
    <Sidebar page="workItems" onNavigate={recordRoute.close} userName={user.name} userKey={user.email} onSignOut={() => !DEMO && signOut(auth)} workItemsOnly />
    {item
      ? <WorkItemRecordPage item={item} actor={actor} actorEmail={user.email} allowedProducts={[...allowedProducts]} assignees={assignees} onBack={recordRoute.close} />
      : recordRoute.route
        ? <RecordRouteUnavailable onBack={recordRoute.close} />
        : <WorkItemsPage items={items} actor={actor} actorEmail={user.email} allowedProducts={[...allowedProducts]} assignees={assignees} onOpen={(candidate) => recordRoute.open("workItem", candidate.referenceId)} />}
  </div>;
}

function AuthenticatedApp({ user }: { user: User }) {
  const email = (user.email ?? "").trim().toLowerCase();
  const admin = email === "amidha111@gmail.com";
  const { accessRecord, loading, error } = useAccessRecord(email, !admin);
  const [previewUser, setPreviewUser] = useState<PreviewUser | null>(null);

  if (loading) return <div className="dot-grid flex min-h-screen items-center justify-center"><p className="text-muted">Loading access…</p></div>;
  if (error || (!admin && (!accessRecord || accessRecord.disabled))) return <SignIn denied />;

  const workspaceUser: WorkspaceUser = {
    name: admin ? "Amit Midha" : accessRecord!.displayName,
    email,
    uid: user.uid,
  };
  if (previewUser && admin) {
    const previewWorkspaceUser = { name: previewUser.name, email: previewUser.email, uid: `preview:${previewUser.email}` };
    const planClarityOnly = !previewUser.workItemProducts.includes("klego");
    const workspace = previewUser.accessRole === "work_items_only"
      ? <WorkItemsOnlyWorkspace user={previewWorkspaceUser} planClarityOnly={planClarityOnly} />
      : <FullWorkspace user={previewWorkspaceUser} planClarityWorkItemsOnly={planClarityOnly} />;
    return <ReadOnlyPreview user={previewUser} onExit={() => setPreviewUser(null)}>{workspace}</ReadOnlyPreview>;
  }
  if (accessRecord?.accessRole === "work_items_only") {
    return <WorkItemsOnlyWorkspace user={workspaceUser} planClarityOnly={!accessRecord.workItemProducts.includes("klego")} />;
  }
  return <FullWorkspace
    user={workspaceUser}
    planClarityWorkItemsOnly={!admin && !accessRecord!.workItemProducts.includes("klego")}
    onLoginAs={admin ? setPreviewUser : undefined}
  />;
}

export default function App() {
  const [user, setUser] = useState<User | null | "loading">(DEMO ? null : "loading");

  useEffect(() => {
    if (DEMO) return;
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  if (DEMO) {
    return <FullWorkspace user={{ name: "Amit Midha", email: "demo@planclarity.local", uid: "demo" }} />;
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

  return <AuthenticatedApp user={user} />;
}
