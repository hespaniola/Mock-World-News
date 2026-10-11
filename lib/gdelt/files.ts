import { unzipSync, strFromU8 } from "fflate";

// GDELT 2.0 publishes a new Events export and GKG file every 15 minutes at
// http://data.gdeltproject.org/gdeltv2/<YYYYMMDDHHMMSS>.<kind>.zip and lists
// the newest set in lastupdate.txt. Files are immutable once published.
// GDELT_BASE_URL exists only to point local test runs at a file mirror.
const BASE = process.env.GDELT_BASE_URL ?? "http://data.gdeltproject.org/gdeltv2";
const LAST_UPDATE_URL = `${BASE}/lastupdate.txt`;
export const SLOT_MS = 15 * 60 * 1000;

export type FileKind = "export.CSV" | "gkg.csv";

/** Timestamp of the newest published slot, from lastupdate.txt. */
export async function latestSlot(): Promise<Date> {
  const res = await fetch(LAST_UPDATE_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`lastupdate.txt: HTTP ${res.status}`);
  const text = await res.text();
  const m = text.match(/(\d{14})\.export\.CSV\.zip/);
  if (!m) throw new Error("lastupdate.txt: no export file listed");
  return parseStamp(m[1]);
}

export function parseStamp(s: string): Date {
  return new Date(
    Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14)),
  );
}

export function formatStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    p(d.getUTCMonth() + 1) +
    p(d.getUTCDate()) +
    p(d.getUTCHours()) +
    p(d.getUTCMinutes()) +
    p(d.getUTCSeconds())
  );
}

export function fileUrl(slot: Date, kind: FileKind): string {
  return `${BASE}/${formatStamp(slot)}.${kind}.zip`;
}

/**
 * Download and unzip one slot file. Returns null when GDELT skipped the
 * slot (it occasionally does), so callers can tolerate gaps.
 */
export async function fetchSlotText(slot: Date, kind: FileKind): Promise<string | null> {
  const res = await fetch(fileUrl(slot, kind), { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${kind} ${formatStamp(slot)}: HTTP ${res.status}`);
  const zip = unzipSync(new Uint8Array(await res.arrayBuffer()));
  const entry = Object.values(zip)[0];
  return entry ? strFromU8(entry) : null;
}

/** Run async jobs with bounded concurrency, preserving input order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
