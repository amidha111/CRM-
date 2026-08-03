import type { WorkItemAssignee } from "../types";

type AssignedWorkItem = Pick<WorkItemAssignee, "email" | "name">;

export function assigneeForWorkItemSave(
  item: { assigneeEmail: string; assigneeName: string } | undefined,
  selectedEmail: string,
  assignees: WorkItemAssignee[],
): WorkItemAssignee | null {
  if (item && selectedEmail === item.assigneeEmail) {
    return { email: item.assigneeEmail, name: item.assigneeName } satisfies AssignedWorkItem;
  }
  return assignees.find((person) => person.email === selectedEmail) ?? assignees[0] ?? null;
}
