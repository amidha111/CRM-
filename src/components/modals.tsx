import { useMemo, useState } from "react";
import {
  OPEN_STAGES,
  ROLE_LABELS,
  STAGE_LABELS,
  type Account,
  type AccountRefInput,
  type Actor,
  type Contact,
  type ContactRoleKind,
  type Opportunity,
  type Stage,
  type StakeholderInput,
} from "../types";
import { createAccount, createContact, createOpportunity, logTouch, addStakeholder } from "../lib/store";
import { Avatar, Field, GhostButton, Modal, PrimaryButton, inputCls } from "./ui";

const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as [ContactRoleKind, string][];

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 12); // noon avoids TZ edge cases
}

export type LookupValue = { id: string | null; name: string };

/** SF-style lookup: search existing records or create one inline by typing a new name. */
function LookupPicker({
  items,
  value,
  onChange,
  placeholder,
  createLabel,
  linkedLabel,
  newLabel,
}: {
  items: { id: string; name: string; sub?: string }[];
  value: LookupValue;
  onChange: (v: LookupValue) => void;
  placeholder: string;
  createLabel: string; // e.g. 'Create contact "{name}"'
  linkedLabel: string;
  newLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const q = value.name.trim().toLowerCase();
    if (!q) return items.slice(0, 6);
    return items.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [items, value.name]);

  const exact = items.some((c) => c.name.toLowerCase() === value.name.trim().toLowerCase());

  return (
    <div className="relative">
      <input
        className={inputCls}
        placeholder={placeholder}
        value={value.name}
        onChange={(e) => {
          onChange({ id: null, name: e.target.value });
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
                value.id === c.id ? "bg-gold-soft" : ""
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange({ id: c.id, name: c.name });
                setOpen(false);
              }}
            >
              <Avatar name={c.name} size={22} />
              <span className="font-medium text-ink">{c.name}</span>
              {c.sub && <span className="text-xs text-muted">· {c.sub}</span>}
            </button>
          ))}
          {!exact && (
            <button
              type="button"
              className="flex w-full items-center gap-2 border-t border-line px-3 py-2 text-left text-sm font-semibold text-gold-deep hover:bg-gold-soft"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange({ id: null, name: value.name.trim() });
                setOpen(false);
              }}
            >
              + {createLabel.replace("{name}", value.name.trim())}
            </button>
          )}
        </div>
      )}
      {value.id && <p className="mt-1 text-xs text-success">{linkedLabel}</p>}
      {!value.id && value.name.trim() && <p className="mt-1 text-xs text-muted">{newLabel}</p>}
    </div>
  );
}

export function ContactPicker({
  contacts,
  value,
  onChange,
}: {
  contacts: Contact[];
  value: LookupValue;
  onChange: (v: LookupValue) => void;
}) {
  return (
    <LookupPicker
      items={contacts.map((c) => ({ id: c.id, name: c.name, sub: c.accountName || undefined }))}
      value={value}
      onChange={onChange}
      placeholder="Search contacts or type a new name…"
      createLabel={'Create contact "{name}"'}
      linkedLabel="Linked to existing contact"
      newLabel="Will be created as a new contact"
    />
  );
}

export function AccountPicker({
  accounts,
  value,
  onChange,
}: {
  accounts: Account[];
  value: LookupValue;
  onChange: (v: LookupValue) => void;
}) {
  return (
    <LookupPicker
      items={accounts.map((a) => ({ id: a.id, name: a.name, sub: a.industry || undefined }))}
      value={value}
      onChange={onChange}
      placeholder="Search accounts or type a new name…"
      createLabel={'Create account "{name}"'}
      linkedLabel="Linked to existing account"
      newLabel="Will be created as a new account"
    />
  );
}

function toAccountRef(v: LookupValue): AccountRefInput {
  return v.id ? { accountId: v.id, name: v.name } : { accountId: null, name: v.name.trim() };
}

export function NewOpportunityModal({
  contacts,
  accounts,
  owners,
  actor,
  onClose,
  initialAccount,
}: {
  contacts: Contact[];
  accounts: Account[];
  owners: string[];
  actor: Actor;
  onClose: () => void;
  initialAccount?: LookupValue;
}) {
  const [name, setName] = useState("");
  const [account, setAccount] = useState<LookupValue>(initialAccount ?? { id: null, name: "" });
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<Stage>("qualification");
  const [closeDate, setCloseDate] = useState("");
  const [owner, setOwner] = useState(owners[0] ?? "");
  const [stakeholder, setStakeholder] = useState<LookupValue>({ id: null, name: "" });
  const [role, setRole] = useState<ContactRoleKind>("decision_maker");
  const [actionText, setActionText] = useState("");
  const [actionDue, setActionDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = [
    !name.trim() && "Opportunity Name",
    !account.name.trim() && "Account",
    !stakeholder.name.trim() && "Primary Stakeholder",
    !amount && "Amount",
    !closeDate && "Expected Close",
    !actionText.trim() && "First Next Best Action",
    !actionDue && "action due date",
  ].filter(Boolean) as string[];
  const valid = missing.length === 0;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const sh: StakeholderInput = stakeholder.id
        ? { contactId: stakeholder.id, name: stakeholder.name, role, isPrimary: true }
        : { contactId: null, name: stakeholder.name.trim(), role, isPrimary: true };
      await createOpportunity(
        {
          name: name.trim(),
          account: toAccountRef(account),
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
            <AccountPicker accounts={accounts} value={account} onChange={setAccount} />
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
            <ContactPicker contacts={contacts} value={stakeholder} onChange={setStakeholder} />
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
        <div className="flex items-center justify-end gap-2">
          {!valid && (
            <p className="mr-auto text-xs text-muted">
              Still needed: <span className="font-medium text-gold-deep">{missing.join(", ")}</span>
            </p>
          )}
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={submit} disabled={!valid || busy}>
            {busy ? "Creating…" : "+ Create Opportunity"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

export function NewAccountModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createAccount({
        name: name.trim(),
        industry: industry.trim() || undefined,
        website: website.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
      setBusy(false);
    }
  }

  return (
    <Modal title="New Account" onClose={onClose} width={480}>
      <div className="flex flex-col gap-4">
        <Field label="Account Name">
          <input className={inputCls} placeholder="Company name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Industry (optional)">
            <input className={inputCls} placeholder="e.g., Technology" value={industry} onChange={(e) => setIndustry(e.target.value)} />
          </Field>
          <Field label="Phone (optional)">
            <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
        <Field label="Website (optional)">
          <input className={inputCls} placeholder="company.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={submit} disabled={!name.trim() || busy}>
            {busy ? "Creating…" : "+ Create Account"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

export function NewContactModal({
  accounts,
  onClose,
  initialAccount,
}: {
  accounts: Account[];
  onClose: () => void;
  initialAccount?: LookupValue;
}) {
  const [name, setName] = useState("");
  const [account, setAccount] = useState<LookupValue>(initialAccount ?? { id: null, name: "" });
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createContact({
        name: name.trim(),
        account: account.name.trim() ? toAccountRef(account) : null,
        title: title.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
      setBusy(false);
    }
  }

  return (
    <Modal title="New Contact" onClose={onClose} width={480}>
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <input className={inputCls} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Account (optional)">
          <AccountPicker accounts={accounts} value={account} onChange={setAccount} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Title (optional)">
            <input className={inputCls} placeholder="CFO" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Email (optional)">
            <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>
        <Field label="Phone (optional)">
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={submit} disabled={!name.trim() || busy}>
            {busy ? "Creating…" : "+ Create Contact"}
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
  const [stakeholder, setStakeholder] = useState<LookupValue>({ id: null, name: "" });
  const [role, setRole] = useState<ContactRoleKind>("shareholder");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyLinked = stakeholder.id !== null && opp.contactIds.includes(stakeholder.id);
  const valid = stakeholder.name.trim() && !alreadyLinked;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const input: StakeholderInput = stakeholder.id
        ? { contactId: stakeholder.id, name: stakeholder.name, role, isPrimary }
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
          <ContactPicker contacts={contacts} value={stakeholder} onChange={setStakeholder} />
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
        {!stakeholder.id && (
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
