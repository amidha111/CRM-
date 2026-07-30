export const WORK_ITEM_ASSIGNEES = [
  { email: "amidha111@gmail.com", name: "Amit Midha" },
  { email: "rahul@klego.ai", name: "Rahul Panchal" },
] as const;

export function findWorkItemAssignee(email: string) {
  const normalized = email.trim().toLowerCase();
  return WORK_ITEM_ASSIGNEES.find((person) => person.email === normalized);
}

export function workItemAssignee(email: string) {
  return findWorkItemAssignee(email) ?? WORK_ITEM_ASSIGNEES[0];
}
