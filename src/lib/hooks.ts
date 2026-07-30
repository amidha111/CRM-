import { useEffect, useState } from "react";
import type { Account, AllowedUser, Activity, Contact, Opportunity } from "../types";
import {
  subscribeAccounts,
  subscribeAccessRecord,
  subscribeActivities,
  subscribeAllowedUsers,
  subscribeContacts,
  subscribeOpportunities,
} from "./store";

export function useOpportunities() {
  const [opps, setOpps] = useState<Opportunity[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => subscribeOpportunities(setOpps, setError), []);
  return { opps, error };
}

export function useAccessRecord(email: string, enabled: boolean) {
  const [accessRecord, setAccessRecord] = useState<AllowedUser | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    return subscribeAccessRecord(email, (record) => {
      setAccessRecord(record);
      setLoading(false);
    }, (reason) => {
      setError(reason);
      setLoading(false);
    });
  }, [email, enabled]);
  return { accessRecord, loading, error };
}

export function useActivities() {
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => subscribeActivities(setActivities, setError), []);
  return { activities, error };
}

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => subscribeContacts(setContacts, setError), []);
  return { contacts, error };
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => subscribeAccounts(setAccounts, setError), []);
  return { accounts, error };
}

export function useAllowedUsers(enabled: boolean) {
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([]);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (!enabled) return;
    return subscribeAllowedUsers(setAllowedUsers, setError);
  }, [enabled]);
  return { allowedUsers, error };
}
