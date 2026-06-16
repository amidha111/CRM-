import { useMemo, useState } from "react";
import type { Account, Contact, Opportunity } from "../types";
import { Avatar, PrimaryButton, inputCls } from "../components/ui";
import { NewContactModal } from "../components/modals";
import type { OpenRecord } from "../components/record";
import { PageHeader } from "../components/pageChrome";
import { PIcon } from "../components/icons";

type ContactFilter = "all" | "accounted" | "unassigned";

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
  const [contactFilter, setContactFilter] = useState<ContactFilter>("all");
  const [showNew, setShowNew] = useState(false);

  const dealCountByContact = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of opps) for (const id of o.contactIds) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [opps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (contactFilter === "accounted" && !c.accountId) return false;
      if (contactFilter === "unassigned" && c.accountId) return false;
      if (
        q &&
        !`${c.firstName} ${c.lastName} ${c.name} ${c.accountName} ${c.title ?? ""} ${c.email ?? ""}`
          .concat(` ${c.linkedinUrl ?? ""}`)
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [contacts, contactFilter, search]);

  const linkedDeals = useMemo(
    () => filtered.reduce((sum, c) => sum + (dealCountByContact.get(c.id) ?? 0), 0),
    [dealCountByContact, filtered],
  );

  const filterLabel = contactFilter === "all" ? "All" : contactFilter === "accounted" ? "With account" : "No account";

  return (
    <div className="page-frame">
      <PageHeader
        icon="users"
        kind="Contacts"
        title="All Contacts"
        meta={`${filtered.length} contacts · updated now`}
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
              New Contact
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
          value={contactFilter}
          onChange={(e) => setContactFilter(e.target.value as ContactFilter)}
        >
          <option value="all">All contacts</option>
          <option value="accounted">With account</option>
          <option value="unassigned">No account</option>
        </select>
        <span className="filter-chip">
          <span className="text-gold-deep">Contact</span>
          <b>{filterLabel}</b>
          <PIcon name="x" size={11} sw={2.2} className="text-gold-deep" />
        </span>
        <span className="hidden items-center gap-1.5 px-1.5 text-xs font-semibold text-muted sm:inline-flex">
          <PIcon name="filter" size={13} />
          Add filter
        </span>
        <span className="ml-auto font-mono text-[11px] text-faint">
          {filtered.length} CONTACTS · {linkedDeals} LINKED DEALS
        </span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-line bg-tone/70 text-left font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">
              <th className="w-[38px] px-5 py-3.5"><span className="block h-4 w-4 rounded border border-[#cfcaba]" /></th>
              <th className="px-5 py-3.5">Name</th>
              <th className="px-3 py-3.5">Account</th>
              <th className="px-3 py-3.5">Title</th>
              <th className="px-3 py-3.5">Email</th>
              <th className="px-3 py-3.5">LinkedIn</th>
              <th className="px-5 py-3.5 text-right">Linked Deals</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                onClick={() => onOpenRecord("contact", c.id)}
                className="cursor-pointer border-b border-line-soft last:border-0 hover:bg-gold-soft/35"
              >
                <td className="px-5 py-4">
                  <span className="block h-4 w-4 rounded border border-[#cfcaba] bg-paper" />
                </td>
                <td className="px-5 py-4">
                  <span className="flex items-center gap-2.5">
                    <Avatar name={c.name} size={28} />
                    <span className="font-semibold text-gold-deep hover:underline">{c.name}</span>
                  </span>
                </td>
                <td className="px-3 py-4 text-muted">{c.accountName || "—"}</td>
                <td className="px-3 py-4 text-muted">{c.title ?? "—"}</td>
                <td className="px-3 py-4 text-muted">{c.email ?? "—"}</td>
                <td className="px-3 py-4 text-muted">
                  {c.linkedinUrl ? (
                    <a
                      href={c.linkedinUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="font-semibold text-gold-deep hover:underline"
                    >
                      Profile
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-5 py-4 text-right">
                  <span className="inline-block min-w-7 rounded-md border border-line bg-tone px-2 py-0.5 text-center text-xs font-semibold text-muted">
                    {dealCountByContact.get(c.id) ?? 0}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center text-muted">
                  No contacts match this filter.
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

      {showNew && <NewContactModal accounts={accounts} onClose={() => setShowNew(false)} />}
    </div>
  );
}
