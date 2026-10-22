"use client";
import { useCallback, useEffect, useState } from "react";

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/login") {
    // Hard redirect on purpose: this helper runs outside React, and a full load clears stale client state.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
    throw new Error("Please log in.");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
  return json as T;
}

interface State<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export function useApi<T>(url: string) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiFetch<T>(url)
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((e: Error) => !cancelled && setState((s) => ({ ...s, error: e.message, loading: false })));
    return () => {
      cancelled = true;
    };
  }, [url, tick]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    setTick((t) => t + 1);
  }, []);

  return { ...state, reload };
}
