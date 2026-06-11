import { useMemo, useState } from "react";
import { ROLE_LABELS, type Account, type Activity, type Contact, type Opportunity } from "../types";
import { formatMoney, relativeTime } from "../lib/format";
import { Avatar, EmptyCard, PrimaryButton, StagePill, inputCls } from "../components/ui";
import { NewContactModal } from "../components/modals";

export function ContactsPage({
  contacts,
  accounts,
  opps,
  activities,
  onOpenOpp,
}: {
  contacts: Contact[];
  accounts: Account[];
  opps: Opportunity[];
  activities: Activity[];
  onOpenOpp: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const selected = contacts.find((c) => c.id === selectedId) ?? null;

  const dealsByContact = useMemo(() => {
    const m = new Map<string, Opportunity[]>();
    for (const o of opps)
      for (const id of o.contactIds) {
        if (!m.has(id)) m.set(id, []);
        m.get(id)!.push(o);
      }
    return m;
  }, [opps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      `${c.name} ${c.accountName} ${c.title ?? ""} ${c.email ?? ""}`.toLowerCase().includes(q),
    );
  }, [contacts, search]);

  const selectedDeals = selected ? (dealsByContact.get(selected.id) ?? []) : [];
  const selectedActivities = useMemo(
    () => (selected ? activities.filter((a) => a.contactId === selected.id) : []),
    [activities, selected],
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-line bg-canvas/90 px-8 py-4 backdrop-blur">
        <h1 className="text-2xl font-bold text-ink">Contacts</h1>
        <input
          className={`${inputCls} ml-auto max-w-64`}
          placeholder="Search contacts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <PrimaryButton onClick={() => setShowNew(true)}>+ New Contact</PrimaryButton>
      </header>

      <div className="p-8">
        {contacts.length === 0 ? (
          <EmptyCard
            icon="◉"
            title="No contacts yet"
            line="Contacts are created automatically when you add stakeholders to deals, or create one here."
            action={<PrimaryButton onClick={() => setShowNew(true)}>+ New Contact</PrimaryButton>}
          />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-5 py-3.5">Name</th>
                  <th className="px-3 py-3.5">Account</th>
                  <th className="px-3 py-3.5">Title</th>
                  <th className="px-3 py-3.5">Email</th>
                  <th className="px-5 py-3.5 text-right">Linked Deals</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-gold-soft/30"
                  >
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-2.5 font-semibold text-ink">
                        <Avatar name={c.name} size={28} />
                        {c.name}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-muted">{c.accountName || "—"}</td>
                    <td className="px-3 py-4 text-muted">{c.title ?? "—"}</td>
                    <td className="px-3 py-4 text-muted">{c.email ?? "—"}</td>
                    <td className="px-5 py-4 text-right">
                      <span className="inline-block min-w-7 rounded-full bg-slate-100 px-2 py-0.5 text-center text-xs font-semibold text-slate-600">
                        {(dealsByContact.get(c.id) ?? []).length}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-muted">
                      No contacts match this search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[440px] flex-col overflow-y-auto rounded-l-3xl border-l border-line bg-white shadow-2xl">
          <div className="border-b border-line p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={selected.name} size={44} />
                <div>
                  <h2 className="text-xl font-bold text-ink">{selected.name}</h2>
                  <p className="text-sm text-muted">
                    {[selected.title, selected.accountName || null].filter(Boolean).join(" · ") || "No details yet"}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedId(null)} aria-label="Close panel" className="text-xl text-muted hover:text-ink">
                ×
              </button>
            </div>
            {(selected.email || selected.phone) && (
              <p className="mt-3 text-sm text-muted">{[selected.email, selected.phone].filter(Boolean).join(" · ")}</p>
            )}
          </div>

          <div className="border-b border-line p-6">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Deals</h3>
            <div className="flex flex-col gap-2.5">
              {selectedDeals.length === 0 && <p className="text-sm text-muted">Not linked to any deals yet.</p>}
              {selectedDeals.map((o) => {
                const role = o.contactRoles.find((r) => r.contactId === selected.id);
                return (
                  <button
                    key={o.id}
                    onClick={() => onOpenOpp(o.id)}
                    className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2.5 text-left hover:bg-gold-soft/30"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">
                        {o.name}
                        {role?.isPrimary && (
                          <span title="Primary stakeholder" className="text-gold-deep">★</span>
                        )}
                      </span>
                      <span className="text-xs text-muted">
                        {formatMoney(o.amount)}
                        {role ? ` · ${ROLE_LABELS[role.role]}` : ""}
                      </span>
                    </span>
                    <StagePill stage={o.stage} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 p-6">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Activity Involving {selected.name.split(" ")[0]}</h3>
            <div className="flex flex-col gap-3">
              {selectedActivities.length === 0 && <p className="text-sm text-muted">No logged activity yet.</p>}
              {selectedActivities.map((a) => (
                <div key={a.id} className="text-sm">
                  <p className="text-ink">{a.detail} · <span className="font-medium">{a.oppName}</span></p>
                  {a.note && <p className="mt-0.5 text-xs italic text-muted">"{a.note}"</p>}
                  <p className="text-xs text-muted">{a.actor} · {relativeTime(a.createdAt)}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      )}

      {showNew && <NewContactModal accounts={accounts} onClose={() => setShowNew(false)} />}
    </div>
  );
}
