import { useMemo, useState } from "react";
import type { Account, Contact, Opportunity } from "../types";
import { Avatar, EmptyCard, PrimaryButton, inputCls } from "../components/ui";
import { NewContactModal } from "../components/modals";
import type { OpenRecord } from "../components/record";

export function ContactsPage({
  contacts,
  accounts,
  opps,
  onOpenRecord,
}: {
  contacts: Contact[];
  accounts: Account[];
  opps: Opportunity[];
  onOpenRecord: OpenRecord;
}) {
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

  const dealCountByContact = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of opps) for (const id of o.contactIds) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [opps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      `${c.name} ${c.accountName} ${c.title ?? ""} ${c.email ?? ""}`.toLowerCase().includes(q),
    );
  }, [contacts, search]);

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
                    onClick={() => onOpenRecord("contact", c.id)}
                    className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-gold-soft/30"
                  >
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-2.5">
                        <Avatar name={c.name} size={28} />
                        <span className="font-semibold text-gold-deep hover:underline">{c.name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-4 text-muted">{c.accountName || "—"}</td>
                    <td className="px-3 py-4 text-muted">{c.title ?? "—"}</td>
                    <td className="px-3 py-4 text-muted">{c.email ?? "—"}</td>
                    <td className="px-5 py-4 text-right">
                      <span className="inline-block min-w-7 rounded-full bg-slate-100 px-2 py-0.5 text-center text-xs font-semibold text-slate-600">
                        {dealCountByContact.get(c.id) ?? 0}
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

      {showNew && <NewContactModal accounts={accounts} onClose={() => setShowNew(false)} />}
    </div>
  );
}
