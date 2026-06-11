import { useMemo, useState } from "react";
import { OPEN_STAGES, type Account, type Actor, type Contact, type Opportunity } from "../types";
import { formatMoney, relativeTime } from "../lib/format";
import { Avatar, GhostButton, PrimaryButton, StagePill } from "../components/ui";
import { Breadcrumb, RecordHeader, RecordLink, RecordSection, type OpenRecord } from "../components/record";
import { EditAccountModal, NewContactModal, NewOpportunityModal } from "../components/modals";
import { deleteAccount } from "../lib/store";

export function AccountRecordPage({
  account,
  opps,
  contacts,
  accounts,
  actor,
  owners,
  onBack,
  onOpenRecord,
}: {
  account: Account;
  opps: Opportunity[];
  contacts: Contact[];
  accounts: Account[];
  actor: Actor;
  owners: string[];
  onBack: () => void;
  onOpenRecord: OpenRecord;
}) {
  const [showNewOpp, setShowNewOpp] = useState(false);
  const [showNewContact, setShowNewContact] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(`Delete account "${account.name}"? This cannot be undone.`)) return;
    try {
      await deleteAccount(account);
      onBack();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  const related = useMemo(() => {
    const deals = opps.filter((o) => o.accountId === account.id);
    const people = contacts.filter((c) => c.accountId === account.id);
    const open = deals.filter((o) => OPEN_STAGES.includes(o.stage));
    return {
      deals,
      people,
      openPipeline: open.reduce((s, o) => s + o.amount, 0),
      openDeals: open.length,
    };
  }, [opps, contacts, account.id]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 p-8">
        <Breadcrumb list="Accounts" onBack={onBack} current={account.name} />

        <RecordHeader
          icon="▣"
          entity="Account"
          title={account.name}
          actions={
            <>
              <button
                onClick={handleDelete}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-danger hover:bg-danger-soft transition"
              >
                Delete
              </button>
              <GhostButton onClick={() => setShowNewContact(true)}>+ Contact</GhostButton>
              <GhostButton onClick={() => setShowEdit(true)}>Edit</GhostButton>
              <PrimaryButton onClick={() => setShowNewOpp(true)}>+ Opportunity</PrimaryButton>
            </>
          }
          highlights={[
            { label: "Industry", value: account.industry ?? "—" },
            {
              label: "Website",
              value: account.website ? (
                <a
                  href={account.website.startsWith("http") ? account.website : `https://${account.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gold-deep underline"
                >
                  {account.website}
                </a>
              ) : (
                "—"
              ),
            },
            { label: "Phone", value: account.phone ?? "—" },
            { label: "Open Pipeline", value: formatMoney(related.openPipeline) },
            { label: "Open Deals", value: String(related.openDeals) },
          ]}
        />

        {deleteError && (
          <div className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{deleteError}</div>
        )}

        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <RecordSection
            title={`Opportunities (${related.deals.length})`}
            action={
              <button onClick={() => setShowNewOpp(true)} className="text-sm font-semibold text-gold-deep hover:underline">
                + New
              </button>
            }
          >
            <div className="flex flex-col gap-2.5">
              {related.deals.length === 0 && <p className="text-sm text-muted">No deals at this account yet.</p>}
              {related.deals.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2.5"
                >
                  <span className="min-w-0">
                    <RecordLink onClick={() => onOpenRecord("opportunity", o.id)}>{o.name}</RecordLink>
                    <span className="block text-xs text-muted">
                      {formatMoney(o.amount)} · updated {relativeTime(o.updatedAt)}
                    </span>
                  </span>
                  <StagePill stage={o.stage} />
                </div>
              ))}
            </div>
          </RecordSection>

          <RecordSection
            title={`Contacts (${related.people.length})`}
            action={
              <button onClick={() => setShowNewContact(true)} className="text-sm font-semibold text-gold-deep hover:underline">
                + New
              </button>
            }
          >
            <div className="flex flex-col gap-3">
              {related.people.length === 0 && <p className="text-sm text-muted">No contacts at this account yet.</p>}
              {related.people.map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <Avatar name={c.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <RecordLink onClick={() => onOpenRecord("contact", c.id)}>{c.name}</RecordLink>
                    <p className="text-xs text-muted">{[c.title, c.email].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
              ))}
            </div>
          </RecordSection>
        </div>
      </div>

      {showEdit && <EditAccountModal account={account} onClose={() => setShowEdit(false)} />}
      {showNewOpp && (
        <NewOpportunityModal
          contacts={contacts}
          accounts={accounts}
          owners={owners}
          actor={actor}
          initialAccount={{ id: account.id, name: account.name }}
          onClose={() => setShowNewOpp(false)}
        />
      )}
      {showNewContact && (
        <NewContactModal
          accounts={accounts}
          initialAccount={{ id: account.id, name: account.name }}
          onClose={() => setShowNewContact(false)}
        />
      )}
    </div>
  );
}
