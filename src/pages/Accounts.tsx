import { useMemo, useState } from "react";
import { OPEN_STAGES, type Account, type Contact, type Opportunity } from "../types";
import { formatMoney, relativeTime } from "../lib/format";
import { Avatar, PrimaryButton, inputCls } from "../components/ui";
import { NewAccountModal } from "../components/modals";
import type { OpenRecord } from "../components/record";
import { PageHeader } from "../components/pageChrome";
import { PIcon } from "../components/icons";

type AccountFilter = "all" | "open" | "empty";

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
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("all");
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
      if (!c.accountId) continue;
      const r = m.get(c.accountId);
      if (r) r.contacts += 1;
    }
    return m;
  }, [accounts, opps, contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      const r = rollups.get(a.id);
      if (accountFilter === "open" && !(r?.openDeals ?? 0)) return false;
      if (accountFilter === "empty" && ((r?.openDeals ?? 0) || (r?.contacts ?? 0))) return false;
      if (q && !`${a.name} ${a.industry ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [accounts, accountFilter, rollups, search]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, a) => {
          const r = rollups.get(a.id);
          acc.pipeline += r?.openPipeline ?? 0;
          acc.contacts += r?.contacts ?? 0;
          return acc;
        },
        { pipeline: 0, contacts: 0 },
      ),
    [filtered, rollups],
  );

  const filterLabel = accountFilter === "all" ? "All" : accountFilter === "open" ? "Open" : "No activity";

  return (
    <div className="page-frame">
      <PageHeader
        icon="briefcase"
        kind="Accounts"
        title="All Accounts"
        meta={`${filtered.length} accounts · updated now`}
        actions={
          <>
            <button className="icon-button" title="Refresh" type="button">
              <PIcon name="refresh" size={15} />
            </button>
            <span className="segmented" aria-label="View mode">
              <span className="on">
                <PIcon name="list" size={15} />
              </span>
              <span>
                <PIcon name="board" size={15} />
              </span>
            </span>
            <button className="toolbar-button hidden sm:inline-flex" type="button">
              <PIcon name="mail" size={15} />
              Import
            </button>
            <PrimaryButton onClick={() => setShowNew(true)}>
              <PIcon name="plus" size={15} sw={2.2} />
              New Account
            </PrimaryButton>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <span className="flex h-8 w-full items-center gap-2 rounded-lg border border-line bg-paper px-3 text-sm text-faint sm:w-[250px]">
          <PIcon name="search" size={14} />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
            placeholder="Search this list..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </span>
        <select
          className={`${inputCls} h-8 w-full py-1 sm:w-44`}
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value as AccountFilter)}
        >
          <option value="all">All accounts</option>
          <option value="open">Open pipeline</option>
          <option value="empty">No activity</option>
        </select>
        <span className="filter-chip">
          <span className="text-gold-deep">Account</span>
          <b>{filterLabel}</b>
          <PIcon name="x" size={11} sw={2.2} className="text-gold-deep" />
        </span>
        <span className="hidden items-center gap-1.5 px-1.5 text-xs font-semibold text-muted sm:inline-flex">
          <PIcon name="filter" size={13} />
          Add filter
        </span>
        <span className="ml-auto font-mono text-[11px] text-faint">
          {formatMoney(totals.pipeline)} PIPELINE · {totals.contacts} CONTACTS
        </span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-line bg-tone/70 text-left font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">
              <th className="w-[38px] px-5 py-3.5"><span className="block h-4 w-4 rounded border border-[#cfcaba]" /></th>
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
                  className="cursor-pointer border-b border-line-soft last:border-0 hover:bg-gold-soft/35"
                >
                  <td className="px-5 py-4">
                    <span className="block h-4 w-4 rounded border border-[#cfcaba] bg-paper" />
                  </td>
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
                <td colSpan={7} className="px-5 py-16 text-center text-muted">
                  No accounts match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="table-footer">
          <span>1-{filtered.length} OF {filtered.length}</span>
          <span>·</span>
          <span>50 PER PAGE</span>
          <span className="ml-auto flex items-center gap-1">
            <span className="flex h-[26px] w-[26px] rotate-180 items-center justify-center rounded-md border border-line bg-paper text-muted">
              <PIcon name="chevronRight" size={13} />
            </span>
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-md border border-line bg-paper text-muted">
              <PIcon name="chevronRight" size={13} />
            </span>
          </span>
        </div>
      </div>

      {showNew && <NewAccountModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
