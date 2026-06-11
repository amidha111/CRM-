import { useMemo, useState } from "react";
import { OPEN_STAGES, type Account, type Contact, type Opportunity } from "../types";
import { formatMoney, relativeTime } from "../lib/format";
import { Avatar, EmptyCard, PrimaryButton, StagePill, inputCls } from "../components/ui";
import { NewAccountModal, NewContactModal, NewOpportunityModal } from "../components/modals";
import type { Actor } from "../types";

export function AccountsPage({
  accounts,
  opps,
  contacts,
  actor,
  owners,
  onOpenOpp,
}: {
  accounts: Account[];
  opps: Opportunity[];
  contacts: Contact[];
  actor: Actor;
  owners: string[];
  onOpenOpp: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newOppFor, setNewOppFor] = useState<Account | null>(null);
  const [newContactFor, setNewContactFor] = useState<Account | null>(null);

  const selected = accounts.find((a) => a.id === selectedId) ?? null;

  const rollups = useMemo(() => {
    const m = new Map<string, { openPipeline: number; openDeals: number; contacts: number; lastTouch: Date | null }>();
    for (const a of accounts) m.set(a.id, { openPipeline: 0, openDeals: 0, contacts: 0, lastTouch: null });
    for (const o of opps) {
      if (!o.accountId) continue;
      const r = m.get(o.accountId);
      if (!r) continue;
      if (OPEN_STAGES.includes(o.stage)) {
        r.openPipeline += o.amount;
        r.openDeals += 1;
      }
      if (!r.lastTouch || o.updatedAt > r.lastTouch) r.lastTouch = o.updatedAt;
    }
    for (const c of contacts) {
      if (c.accountId) {
        const r = m.get(c.accountId);
        if (r) r.contacts += 1;
      }
    }
    return m;
  }, [accounts, opps, contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => `${a.name} ${a.industry ?? ""}`.toLowerCase().includes(q));
  }, [accounts, search]);

  const selectedOpps = useMemo(
    () => (selected ? opps.filter((o) => o.accountId === selected.id) : []),
    [opps, selected],
  );
  const selectedContacts = useMemo(
    () => (selected ? contacts.filter((c) => c.accountId === selected.id) : []),
    [contacts, selected],
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-line bg-canvas/90 px-8 py-4 backdrop-blur">
        <h1 className="text-2xl font-bold text-ink">Accounts</h1>
        <input
          className={`${inputCls} ml-auto max-w-64`}
          placeholder="Search accounts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <PrimaryButton onClick={() => setShowNew(true)}>+ New Account</PrimaryButton>
      </header>

      <div className="p-8">
        {accounts.length === 0 ? (
          <EmptyCard
            icon="▣"
            title="No accounts yet"
            line="Accounts are created automatically when you add a deal, or create one here."
            action={<PrimaryButton onClick={() => setShowNew(true)}>+ New Account</PrimaryButton>}
          />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-5 py-3.5">Account</th>
                  <th className="px-3 py-3.5">Industry</th>
                  <th className="px-3 py-3.5 text-right">Open Pipeline</th>
                  <th className="px-3 py-3.5 text-right">Open Deals</th>
                  <th className="px-3 py-3.5 text-right">Contacts</th>
                  <th className="px-5 py-3.5 text-right">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const r = rollups.get(a.id)!;
                  return (
                    <tr
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-gold-soft/30"
                    >
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-2.5 font-semibold text-ink">
                          <Avatar name={a.name} size={28} />
                          {a.name}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-muted">{a.industry ?? "—"}</td>
                      <td className="px-3 py-4 text-right font-bold text-ink">{formatMoney(r.openPipeline)}</td>
                      <td className="px-3 py-4 text-right text-ink">{r.openDeals}</td>
                      <td className="px-3 py-4 text-right text-ink">{r.contacts}</td>
                      <td className="px-5 py-4 text-right text-xs text-muted">
                        {r.lastTouch ? relativeTime(r.lastTouch) : "—"}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-muted">
                      No accounts match this search.
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
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted">Account</p>
                <h2 className="mt-1 text-2xl font-bold text-ink">{selected.name}</h2>
                <p className="mt-1 text-sm text-muted">
                  {[selected.industry, selected.website, selected.phone].filter(Boolean).join(" · ") || "No details yet"}
                </p>
              </div>
              <button onClick={() => setSelectedId(null)} aria-label="Close panel" className="text-xl text-muted hover:text-ink">
                ×
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-gold-soft/60 px-4 py-3">
                <p className="text-xs text-muted">Open Pipeline</p>
                <p className="text-xl font-bold text-ink">{formatMoney(rollups.get(selected.id)!.openPipeline)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs text-muted">Open Deals</p>
                <p className="text-xl font-bold text-ink">{rollups.get(selected.id)!.openDeals}</p>
              </div>
            </div>
          </div>

          <div className="border-b border-line p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Opportunities</h3>
              <button onClick={() => setNewOppFor(selected)} className="text-sm font-semibold text-gold-deep hover:underline">
                + New
              </button>
            </div>
            <div className="flex flex-col gap-2.5">
              {selectedOpps.length === 0 && <p className="text-sm text-muted">No deals at this account yet.</p>}
              {selectedOpps.map((o) => (
                <button
                  key={o.id}
                  onClick={() => onOpenOpp(o.id)}
                  className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2.5 text-left hover:bg-gold-soft/30"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{o.name}</span>
                    <span className="text-xs text-muted">{formatMoney(o.amount)}</span>
                  </span>
                  <StagePill stage={o.stage} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Contacts</h3>
              <button onClick={() => setNewContactFor(selected)} className="text-sm font-semibold text-gold-deep hover:underline">
                + New
              </button>
            </div>
            <div className="flex flex-col gap-2.5">
              {selectedContacts.length === 0 && <p className="text-sm text-muted">No contacts at this account yet.</p>}
              {selectedContacts.map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <Avatar name={c.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{c.name}</p>
                    <p className="text-xs text-muted">{[c.title, c.email].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      )}

      {showNew && <NewAccountModal onClose={() => setShowNew(false)} />}
      {newOppFor && (
        <NewOpportunityModal
          contacts={contacts}
          accounts={accounts}
          owners={owners}
          actor={actor}
          initialAccount={{ id: newOppFor.id, name: newOppFor.name }}
          onClose={() => setNewOppFor(null)}
        />
      )}
      {newContactFor && (
        <NewContactModal
          accounts={accounts}
          initialAccount={{ id: newContactFor.id, name: newContactFor.name }}
          onClose={() => setNewContactFor(null)}
        />
      )}
    </div>
  );
}
