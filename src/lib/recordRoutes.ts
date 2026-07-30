export type RouteRecordType = "opportunity" | "account" | "contact" | "workItem";

export type RecordRoute = {
  type: RouteRecordType;
  referenceId: string;
};

const ROUTES: Record<RouteRecordType, { segment: string; prefix: string }> = {
  opportunity: { segment: "opportunities", prefix: "OPP" },
  account: { segment: "accounts", prefix: "ACC" },
  contact: { segment: "contacts", prefix: "CON" },
  workItem: { segment: "work-items", prefix: "WI" },
};

export function recordPath(type: RouteRecordType, referenceId: string): string {
  return `/${ROUTES[type].segment}/${encodeURIComponent(referenceId)}`;
}

export function recordRouteFromPath(pathname: string): RecordRoute | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 2) return null;
  const type = (Object.keys(ROUTES) as RouteRecordType[]).find(
    (candidate) => ROUTES[candidate].segment === parts[0],
  );
  if (!type) return null;
  const referenceId = decodeURIComponent(parts[1]).toUpperCase();
  if (!new RegExp(`^${ROUTES[type].prefix}-\\d{4,}$`).test(referenceId)) return null;
  return { type, referenceId };
}
