import { useMemo, useState } from "react";
import { OPEN_STAGES, type Account, type Contact, type Opportunity } from "../types";
import { formatMoney, relativeTime } from "../lib/format";
import { Avatar, EmptyCard, PrimaryButton, inputCls } from "../components/ui";
import { NewAccountModal } from "../components/modals";
import type { OpenRecord } from "../components/record";

export function AccountsPage({
  accounts,
  opps,
  contacts,
  onOpenRecord,
}: {
  accounts: Account[];
  opps: Opportunity[];
  contacts: Contact[];
  onOpenRecord: OpenRecord;
}) {
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

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
                      onClick={() => onOpenRecord("account", a.id)}
                      className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-gold-soft/30"
                    >
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-2.5">
                          <Avatar name={a.name} size={28} />
                          <span className="font-semibold text-gold-deep hover:underline">{a.name}</span>
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

      {showNew && <NewAccountModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
