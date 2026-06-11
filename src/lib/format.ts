export function formatMoney(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function relativeTime(d: Date): string {
  const ms = Date.now() - d.getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export function daysSince(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

/** Due status for a next-action due date. */
export function dueStatus(due: Date): "overdue" | "today" | "upcoming" {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 86_400_000);
  if (due < startOfToday) return "overdue";
  if (due < startOfTomorrow) return "today";
  return "upcoming";
}

export function dueLabel(due: Date): string {
  const status = dueStatus(due);
  if (status === "overdue") {
    const days = daysSince(due);
    return days <= 1 ? "Overdue" : `Overdue ${days}d`;
  }
  if (status === "today") return "Due today";
  const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function dayHeading(d: Date): string {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((startOfToday.getTime() - startOfDay.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
