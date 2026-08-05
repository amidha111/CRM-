import { useMemo, useState } from "react";
import type { Actor, WorkItem, WorkItemAssignee, WorkItemPriority, WorkItemProduct, WorkItemType } from "../types";
import {
  WORK_ITEM_PRIORITY_LABELS,
  WORK_ITEM_PRODUCT_LABELS,
  WORK_ITEM_STATUS_LABELS,
  WORK_ITEM_TYPE_LABELS,
} from "../types";
import { PageHeader } from "../components/pageChrome";
import { PIcon } from "../components/icons";
import { Avatar, EmptyCard, PrimaryButton, inputCls } from "../components/ui";
import { WorkItemModal } from "../components/workItemModal";
import { relativeTime } from "../lib/format";
import { matchesWorkItemVisibility, type WorkItemVisibility } from "../lib/workItemFilters";

export function WorkItemBadge({ value, kind }: { value: string; kind: "type" | "priority" | "status" | "product" }) {
  const tone =
    (kind === "priority" && value === "high") || (kind === "type" && value === "bug")
      ? "border-danger/20 bg-danger-soft text-danger"
      : kind === "status" && value === "closed"
        ? "border-success/30 bg-success-soft text-success"
        : kind === "status" && value === "ready_for_review"
          ? "border-gold/45 bg-gold-soft text-gold-deep"
          : "border-line bg-tone text-muted";
  const labels: Record<string, string> = {
    ...WORK_ITEM_TYPE_LABELS,
    ...WORK_ITEM_PRIORITY_LABELS,
    ...WORK_ITEM_STATUS_LABELS,
    ...WORK_ITEM_PRODUCT_LABELS,
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${tone}`}>{labels[value] ?? value}</span>;
}

export function WorkItemsPage({
  items,
  actor,
  actorEmail,
  onOpen,
  allowedProducts = ["klego", "plan_clarity"],
  assignees,
}: {
  items: WorkItem[];
  actor: Actor;
  actorEmail: string;
  onOpen: (item: WorkItem) => void;
  allowedProducts?: WorkItemProduct[];
  assignees: WorkItemAssignee[];
}) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<WorkItemType | "all">("all");
  const [product, setProduct] = useState<WorkItemProduct | "all">("all");
  const [priority, setPriority] = useState<WorkItemPriority | "all">("all");
  const [visibility, setVisibility] = useState<WorkItemVisibility>("active");
  const [showNew, setShowNew] = useState(false);

  const filtered = useMemo(() => items.filter((item) => {
    const query = search.trim().toLowerCase();
    return (!query || `${item.subject} ${item.assigneeName}`.toLowerCase().includes(query))
      && matchesWorkItemVisibility(item, visibility)
      && (type === "all" || item.type === type)
      && (product === "all" || item.product === product)
      && (priority === "all" || item.priority === priority);
  }), [items, priority, product, search, type, visibility]);

  const listLabel = visibility === "active" ? "active" : visibility === "resolved" ? "resolved" : "total";

  return (
    <div className="page-frame">
      <PageHeader icon="note" kind="Product Delivery" title="Work Items" meta={`${filtered.length} ${listLabel} items · updated now`} actions={
        <>
          <select
            className={`${inputCls} h-9 w-auto min-w-36 py-1 font-semibold`}
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as WorkItemVisibility)}
            aria-label="Choose which Work Items to show"
          >
            <option value="active">Active work</option>
            <option value="resolved">Resolved only</option>
            <option value="all">All work</option>
          </select>
          <PrimaryButton onClick={() => setShowNew(true)}><PIcon name="plus" size={15} sw={2.2} />New Work Item</PrimaryButton>
        </>
      } />
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <span className="flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-paper px-3 text-sm sm:w-[280px]">
          <PIcon name="search" size={14} className="text-faint" />
          <input className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint" placeholder="Search work items…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </span>
        <select className={`${inputCls} h-9 w-auto py-1`} value={type} onChange={(event) => setType(event.target.value as WorkItemType | "all")}>
          <option value="all">All types</option><option value="bug">Bugs</option><option value="feature">Features</option>
        </select>
        {allowedProducts.length > 1 && <select className={`${inputCls} h-9 w-auto py-1`} value={product} onChange={(event) => setProduct(event.target.value as WorkItemProduct | "all")}>
          <option value="all">All products</option>{allowedProducts.includes("klego") && <option value="klego">Klego</option>}{allowedProducts.includes("plan_clarity") && <option value="plan_clarity">Plan Clarity</option>}
        </select>}
        <select className={`${inputCls} h-9 w-auto py-1`} value={priority} onChange={(event) => setPriority(event.target.value as WorkItemPriority | "all")}>
          <option value="all">All priorities</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
        </select>
      </div>
      {items.length === 0 ? (
        <EmptyCard icon="note" title="No work items yet" line="Create the first bug or feature and keep its full lifecycle in one place." action={<PrimaryButton onClick={() => setShowNew(true)}>Create Work Item</PrimaryButton>} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead><tr className="border-b border-line bg-tone/70 text-left font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">
              <th className="px-5 py-3.5">Subject</th><th className="px-3 py-3.5">Type</th><th className="px-3 py-3.5">Product</th><th className="px-3 py-3.5">Priority</th><th className="px-3 py-3.5">Status</th><th className="px-3 py-3.5">Assigned To</th><th className="px-5 py-3.5 text-right">Updated</th>
            </tr></thead>
            <tbody>{filtered.map((item) => <tr key={item.id} onClick={() => onOpen(item)} className="cursor-pointer border-b border-line-soft last:border-0 hover:bg-gold-soft/35">
              <td className="px-5 py-4"><span className="block font-mono text-[10px] font-semibold uppercase tracking-wide text-muted">{item.referenceId}</span><span className="mt-1 block font-semibold text-gold-deep">{item.subject}</span></td>
              <td className="px-3 py-4"><WorkItemBadge value={item.type} kind="type" /></td>
              <td className="px-3 py-4"><WorkItemBadge value={item.product} kind="product" /></td>
              <td className="px-3 py-4"><WorkItemBadge value={item.priority} kind="priority" /></td>
              <td className="px-3 py-4"><WorkItemBadge value={item.status} kind="status" /></td>
              <td className="px-3 py-4"><span className="flex items-center gap-2"><Avatar name={item.assigneeName} size={26} />{item.assigneeName}</span></td>
              <td className="px-5 py-4 text-right text-muted">{relativeTime(item.updatedAt)}</td>
            </tr>)}</tbody>
          </table>
          {filtered.length === 0 && <p className="px-5 py-14 text-center text-sm text-muted">{visibility === "active" ? "No active work items." : "No work items match these filters."}</p>}
        </div>
      )}
      {showNew && <WorkItemModal actor={actor} actorEmail={actorEmail} allowedProducts={allowedProducts} assignees={assignees} onClose={() => setShowNew(false)} />}
    </div>
  );
}
