import { useEffect, useState } from "react";
import type { WorkItem, WorkItemAssignee, WorkItemEvent, WorkItemProduct } from "../types";
import { fetchWorkItemAssignees, subscribeWorkItemEvents, subscribeWorkItems } from "./workItemsStore";

export function useWorkItems(product?: WorkItemProduct) {
  const [items, setItems] = useState<WorkItem[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => subscribeWorkItems(setItems, setError, product), [product]);
  return { items, error };
}

export function useWorkItemAssignees() {
  const [assignees, setAssignees] = useState<WorkItemAssignee[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    void fetchWorkItemAssignees().then(setAssignees).catch((reason) => {
      setError(reason instanceof Error ? reason : new Error("Unable to load Work Item assignees."));
    });
  }, []);
  return { assignees, error };
}

export function useWorkItemEvents(workItemId: string) {
  const [events, setEvents] = useState<WorkItemEvent[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => subscribeWorkItemEvents(workItemId, setEvents, setError), [workItemId]);
  return { events, error };
}
