"use client";

import { useEffect, useState } from "react";
import type { NewsSnapshot } from "@/lib/news/types";

export type NewsState =
  | { status: "loading"; snapshot: null; error: null }
  | { status: "live"; snapshot: NewsSnapshot; error: null }
  | { status: "error"; snapshot: NewsSnapshot | null; error: string };

const RETRY_MS = 60_000;
const MAX_WAIT_MS = 20 * 60_000;

/**
 * Loads /api/news and refetches when GDELT's next 15-minute slot should be
 * out. If the server still has the previous slot, it retries every minute.
 * A failed refresh keeps showing the last good snapshot.
 */
export function useNews(): NewsState {
  const [state, setState] = useState<NewsState>({ status: "loading", snapshot: null, error: null });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    let last: NewsSnapshot | null = null;

    const schedule = (ms: number) => {
      timer = setTimeout(load, Math.max(5_000, Math.min(ms, MAX_WAIT_MS)));
    };

    async function load() {
      try {
        const res = await fetch("/api/news");
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
        const snap = body as NewsSnapshot;
        if (cancelled) return;
        const isNew = !last || snap.dataAsOf !== last.dataAsOf;
        last = snap;
        if (isNew) setState({ status: "live", snapshot: snap, error: null });
        const untilNext = new Date(snap.nextRefreshAt).getTime() - Date.now();
        schedule(untilNext > 0 ? untilNext : RETRY_MS);
      } catch (e) {
        if (cancelled) return;
        setState({ status: "error", snapshot: last, error: e instanceof Error ? e.message : String(e) });
        schedule(RETRY_MS);
      }
    }

    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return state;
}
