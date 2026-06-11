import { useMemo } from "react";
import { ROLE_LABELS, type Activity, type Contact, type Opportunity } from "../types";
import { formatMoney, relativeTime } from "../lib/format";
import { StagePill } from "../components/ui";
import { Breadcrumb, RecordHeader, RecordLink, RecordSection, type OpenRecord } from "../components/record";

export function ContactRecordPage({
  contact,
  opps,
  activities,
  onBack,
  onOpenRecord,
}: {
  contact: Contact;
  opps: Opportunity[];
  activities: Activity[];
  onBack: () => void;
  onOpenRecord: OpenRecord;
}) {
  const deals = useMemo(() => opps.filter((o) => o.contactIds.includes(contact.id)), [opps, contact.id]);
  const involved = useMemo(() => activities.filter((a) => a.contactId === contact.id), [activities, contact.id]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 p-8">
        <Breadcrumb list="Contacts" onBack={onBack} current={contact.name} />

        <RecordHeader
          icon="◉"
          entity="Contact"
          title={contact.name}
          highlights={[
            {
              label: "Account",
              value: contact.accountId ? (
                <RecordLink onClick={() => onOpenRecord("account", contact.accountId!)}>
                  {contact.accountName}
                </RecordLink>
              ) : (
                contact.accountName || "—"
              ),
            },
            { label: "Title", value: contact.title ?? "—" },
            { label: "Email", value: contact.email ?? "—" },
            { label: "Phone", value: contact.phone ?? "—" },
          ]}
        />

        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <RecordSection title={`Opportunities (${deals.length})`}>
            <div className="flex flex-col gap-2.5">
              {deals.length === 0 && <p className="text-sm text-muted">Not linked to any deals yet.</p>}
              {deals.map((o) => {
                const role = o.contactRoles.find((r) => r.contactId === contact.id);
                return (
                  <div
                    key={o.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <RecordLink onClick={() => onOpenRecord("opportunity", o.id)}>{o.name}</RecordLink>
                        {role?.isPrimary && (
                          <span title="Primary stakeholder" className="text-gold-deep">
                            ★
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-muted">
                        {formatMoney(o.amount)}
                        {role ? ` · ${ROLE_LABELS[role.role]}` : ""}
                      </span>
                    </span>
                    <StagePill stage={o.stage} />
                  </div>
                );
              })}
            </div>
          </RecordSection>

          <RecordSection title="Activity Involving This Contact">
            <div className="flex flex-col gap-3">
              {involved.length === 0 && <p className="text-sm text-muted">No logged activity yet.</p>}
              {involved.map((a) => (
                <div key={a.id} className="text-sm">
                  <p className="text-ink">
                    {a.detail} · <RecordLink onClick={() => onOpenRecord("opportunity", a.oppId)}>{a.oppName}</RecordLink>
                  </p>
                  {a.note && <p className="mt-0.5 text-xs italic text-muted">"{a.note}"</p>}
                  <p className="text-xs text-muted">
                    {a.actor} · {relativeTime(a.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </RecordSection>
        </div>
      </div>
    </div>
  );
}
