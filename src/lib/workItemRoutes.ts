const WORK_ITEM_REFERENCE = /^WI-\d{4,}$/;

export function workItemReferenceFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/work-items\/(WI-\d{4,})\/?$/i);
  if (!match) return null;
  const referenceId = match[1].toUpperCase();
  return WORK_ITEM_REFERENCE.test(referenceId) ? referenceId : null;
}

export function workItemPath(referenceId: string): string {
  const normalized = referenceId.trim().toUpperCase();
  if (!WORK_ITEM_REFERENCE.test(normalized)) throw new Error("Invalid Work Item reference.");
  return `/work-items/${normalized}`;
}
