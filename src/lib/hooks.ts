import { useEffect, useState } from "react";
import type { Account, Activity, Contact, Opportunity } from "../types";
import { subscribeAccounts, subscribeActivities, subscribeContacts, subscribeOpportunities } from "./store";

export function useOpportunities() {
  const [opps, setOpps] = useState<Opportunity[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => subscribeOpportunities(setOpps, setError), []);
  return { opps, error };
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
