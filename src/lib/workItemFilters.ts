import type { WorkItem } from "../types";

export type WorkItemVisibility = "active" | "resolved" | "all";

export function matchesWorkItemVisibility(
  item: Pick<WorkItem, "status">,
  visibility: WorkItemVisibility,
): boolean {
  if (visibility === "all") return true;
  return visibility === "resolved" ? item.status === "closed" : item.status !== "closed";
}

