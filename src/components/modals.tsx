import { useMemo, useState } from "react";
import {
  OPEN_STAGES,
  ROLE_LABELS,
  STAGE_LABELS,
  type Actor,
  type Contact,
  type ContactRoleKind,
  type Opportunity,
  type Stage,
  type StakeholderInput,
} from "../types";
import { createOpportunity, logTouch, addStakeholder } from "../lib/store";
import { Avatar, Field, GhostButton, Modal, PrimaryButton, inputCls } from "./ui";

const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as [ContactRoleKind, string][];

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 12); // noon avoids TZ edge cases
}

/** Search-or-create combobox over existing contacts. */
function StakeholderPicker({
  contacts,
  value,
  onChange,
}: {
  contacts: Contact[];
  value: { contactId: string | null; name: string };
  onChange: (v: { contactId: string | null; name: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const q = value.name.trim().toLowerCase();
    if (!q) return contacts.slice(0, 6);
    return contacts.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [contacts, value.name]);

  const exact = contacts.some((c) => c.name.toLowerCase() === value.name.trim().toLowerCase());

  return (
    <div className="relative">
      <input
        className={inputCls}
        placeholder="Search contacts or type a new name…"
        value={value.name}
        onChange={(e) => {
          onChange({ contactId: null, name: e.target.value });
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && value.name.trim() && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-line bg-white shadow-lg">
          {matches.map((c) => (
            <button
              type="button"
              key={c.id}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gold-soft ${
                value.contactId === c.id ? "bg-gold-soft" : ""
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange({ contactId: c.id, name: c.name });
                setOpen(false);
              }}
            >
              <Avatar name={c.name} size={22} />
              <span className="font-medium text-ink">{c.name}</span>
              {c.company && <span className="text-xs text-muted">· {c.company}</span>}
            </button>
          ))}
          {!exact && (
            <button
              type="button"
              className="flex w-full items-center gap-2 border-t border-line px-3 py-2 text-left text-sm font-semibold text-gold-deep hover:bg-gold-soft"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange({ contactId: null, name: value.name.trim() });
                setOpen(false);
              }}
            >
              + Create "{value.name.trim()}"
            </button>
          )}
        </div>
      )}
      {value.contactId && (
        <p className="mt-1 text-xs text-success">Linked to existing contact</p>
      )}
      {!value.contactId && value.name.trim() && (
        <p className="mt-1 text-xs text-muted">Will be created as a new contact</p>
      )}
    </div>
  );
}

export function NewOpportunityModal({
  contacts,
  owners,
  actor,
  onClose,
}: {
  contacts: Contact[];
  owners: string[];
  actor: Actor;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<Stage>("qualification");
  const [closeDate, setCloseDate] = useState("");
  const [owner, setOwner] = useState(owners[0] ?? "");
  const [stakeholder, setStakeholder] = useState<{ contactId: string | null; name: string }>({
    contactId: null,
    name: "",
  });
  const [role, setRole] = useState<ContactRoleKind>("decision_maker");
  const [actionText, setActionText] = useState("");
  const [actionDue, setActionDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    name.trim() &&
    account.trim() &&
    amount &&
    closeDate &&
    stakeholder.name.trim() &&
    actionText.trim() &&
    actionDue;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const sh: StakeholderInput = stakeholder.contactId
        ? { contactId: stakeholder.contactId, name: stakeholder.name, role, isPrimary: true }
        : { contactId: null, name: stakeholder.name.trim(), role, isPrimary: true };
      await createOpportunity(
        {
          name: name.trim(),
          account: account.trim(),
          owner,
          amount: Number(amount),
          stage,
          closeDate: parseLocalDate(closeDate),
          firstAction: { text: actionText.trim(), dueDate: parseLocalDate(actionDue) },
          stakeholder: sh,
        },
        actor,
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
      setBusy(false);
    }
  }

  return (
    <Modal title="New Opportunity" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label="Opportunity Name">
          <input className={inputCls} placeholder="e.g., Enterprise Expansion" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Account">
            <input className={inputCls} placeholder="Company name" value={account} onChange={(e) => setAccount(e.target.value)} />
          </Field>
          <Field label="Owner">
            <select className={inputCls} value={owner} onChange={(e) => setOwner(e.target.value)}>
              {owners.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Primary Stakeholder">
            <StakeholderPicker contacts={contacts} value={stakeholder} onChange={setStakeholder} />
          </Field>
          <Field label="Role">
            <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as ContactRoleKind)}>
              {ROLE_OPTIONS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Amount">
            <input
              className={inputCls}
              type="number"
              min="0"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Stage">
            <select className={inputCls} value={stage} onChange={(e) => setStage(e.target.value as Stage)}>
              {OPEN_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Expected Close">
            <input className={inputCls} type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
          </Field>
        </div>

        <div className="rounded-xl border border-gold bg-gold-soft/60 p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gold-deep">★ First Next Best Action</p>
          <div className="grid grid-cols-[1fr_150px] gap-3">
            <input
              className={inputCls}
              placeholder="e.g., Book discovery call"
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
            />
            <input className={inputCls} type="date" value={actionDue} onChange={(e) => setActionDue(e.target.value)} />
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={submit} disabled={!valid || busy}>
            {busy ? "Creating…" : "+ Create Opportunity"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

export function LogActivityModal({
  opp,
  actor,
  onClose,
}: {
  opp: Opportunity;
  actor: Actor;
  onClose: () => void;
}) {
  const [type, setType] = useState<"call" | "email" | "meeting" | "note">("call");
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [actionText, setActionText] = useState("");
  const [actionDue, setActionDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updatingAction = actionText.trim() !== "";
  const valid = note.trim() && (!updatingAction || actionDue);

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await logTouch(
        opp,
        type,
        note.trim(),
        link.trim() || null,
        updatingAction ? { text: actionText.trim(), dueDate: parseLocalDate(actionDue) } : null,
        actor,
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to log");
      setBusy(false);
    }
  }

  return (
    <Modal title="Log Activity" subtitle={`${opp.name} — ${opp.account}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label="Activity Type">
          <div className="grid grid-cols-4 gap-2">
            {(["call", "email", "meeting", "note"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${
                  type === t ? "border-gold bg-gold-soft text-ink" : "border-line text-muted hover:border-gold/60"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label="What happened?">
          <textarea
            className={`${inputCls} min-h-24 resize-y`}
            placeholder="Discussed the new contract terms…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <Field label="Link (optional)">
          <input className={inputCls} type="url" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} />
        </Field>

        <div className="rounded-xl border border-gold bg-gold-soft/60 p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gold-deep">★ Update Next Best Action</p>
          {opp.nextAction && (
            <p className="mb-2 text-xs text-muted">
              Current: <span className="font-medium text-ink">{opp.nextAction.text}</span> — leave blank to keep it.
            </p>
          )}
          <div className="grid grid-cols-[1fr_150px] gap-3">
            <input
              className={inputCls}
              placeholder="e.g., Send revised pricing proposal"
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
            />
            <input className={inputCls} type="date" value={actionDue} onChange={(e) => setActionDue(e.target.value)} />
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={submit} disabled={!valid || busy}>
            {busy ? "Saving…" : updatingAction ? "Log Activity & Update" : "Log Activity"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

export function AddStakeholderModal({
  opp,
  contacts,
  actor,
  onClose,
}: {
  opp: Opportunity;
  contacts: Contact[];
  actor: Actor;
  onClose: () => void;
}) {
  const [stakeholder, setStakeholder] = useState<{ contactId: string | null; name: string }>({
    contactId: null,
    name: "",
  });
  const [role, setRole] = useState<ContactRoleKind>("shareholder");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyLinked = stakeholder.contactId !== null && opp.contactIds.includes(stakeholder.contactId);
  const valid = stakeholder.name.trim() && !alreadyLinked;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const input: StakeholderInput = stakeholder.contactId
        ? { contactId: stakeholder.contactId, name: stakeholder.name, role, isPrimary }
        : {
            contactId: null,
            name: stakeholder.name.trim(),
            title: title.trim() || undefined,
            email: email.trim() || undefined,
            role,
            isPrimary,
          };
      await addStakeholder(opp, input, actor);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add");
      setBusy(false);
    }
  }

  return (
    <Modal title="Add Stakeholder" subtitle={`${opp.name} — ${opp.account}`} onClose={onClose} width={480}>
      <div className="flex flex-col gap-4">
        <Field label="Contact">
          <StakeholderPicker contacts={contacts} value={stakeholder} onChange={setStakeholder} />
          {alreadyLinked && <p className="mt-1 text-xs text-danger">Already a stakeholder on this deal.</p>}
        </Field>
        <Field label="Role on this deal">
          <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as ContactRoleKind)}>
            {ROLE_OPTIONS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        {!stakeholder.contactId && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Title (optional)">
              <input className={inputCls} placeholder="CFO" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Email (optional)">
              <input className={inputCls} type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
          Primary contact for this deal
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={submit} disabled={!valid || busy}>
            {busy ? "Adding…" : "Add to deal"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
