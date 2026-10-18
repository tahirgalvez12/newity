"use client";

import { useCallback, useSyncExternalStore } from "react";

// No auth in V1: each rep types their name once and this browser remembers it.
const KEY = "newity.repName";
const listeners = new Set<() => void>();

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRepName(): [string, (name: string) => void] {
  const name = useSyncExternalStore(subscribe, read, () => "");
  const setName = useCallback((next: string) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private mode / storage blocked: the name just won't persist.
    }
    listeners.forEach((l) => l());
  }, []);
  return [name, setName];
}
