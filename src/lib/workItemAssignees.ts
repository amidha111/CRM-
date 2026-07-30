export const WORK_ITEM_ASSIGNEES = [
  { email: "amidha111@gmail.com", name: "Amit" },
  { email: "rahul@klego.ai", name: "Rahul" },
] as const;

export function workItemAssignee(email: string) {
  return WORK_ITEM_ASSIGNEES.find((person) => person.email === email) ?? WORK_ITEM_ASSIGNEES[0];
}
