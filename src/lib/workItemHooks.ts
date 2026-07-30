import { useEffect, useState } from "react";
import type { WorkItem, WorkItemEvent, WorkItemProduct } from "../types";
import { subscribeWorkItemEvents, subscribeWorkItems } from "./workItemsStore";

export function useWorkItems(product?: WorkItemProduct) {
  const [items, setItems] = useState<WorkItem[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => subscribeWorkItems(setItems, setError, product), [product]);
  return { items, error };
}

export function useWorkItemEvents(workItemId: string) {
  const [events, setEvents] = useState<WorkItemEvent[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => subscribeWorkItemEvents(workItemId, setEvents, setError), [workItemId]);
  return { events, error };
}
