import { unstable_cache } from "next/cache";
import { buildSnapshot } from "@/lib/news/snapshot";

// GDELT publishes every 15 minutes, so the snapshot is rebuilt at most that
// often and shared by every visitor; nobody's browser talks to GDELT.
// Failures throw and are therefore never cached.
const cachedSnapshot = unstable_cache(buildSnapshot, ["news-snapshot-v1"], { revalidate: 900 });

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const snapshot = await cachedSnapshot();
    return Response.json(snapshot, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (err) {
    console.error("news snapshot failed", err);
    return Response.json(
      { error: "GDELT feed unavailable", detail: err instanceof Error ? err.message : String(err) },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
