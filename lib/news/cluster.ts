import type { Topic } from "@/lib/theme";
import type { Hotspot } from "./types";

export type Cluster = {
  id: string;
  lat: number;
  lng: number;
  /** Total stories across members. */
  count: number;
  topic: Topic | null;
  members: Hotspot[];
};

const RAD = Math.PI / 180;

/** Great-circle distance in degrees. */
export function angularDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * RAD;
  const dLng = (lng2 - lng1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLng / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(a)))) / RAD;
}

/** Dominant topic if it covers at least a quarter of the stories. */
export function dominantTopic(members: Hotspot[]): Topic | null {
  const totals: Partial<Record<Topic, number>> = {};
  let stories = 0;
  for (const h of members) {
    stories += h.count;
    for (const [t, n] of Object.entries(h.topicCounts) as [Topic, number][]) totals[t] = (totals[t] ?? 0) + n;
  }
  let best: Topic | null = null;
  let max = 0;
  for (const [t, n] of Object.entries(totals) as [Topic, number][]) {
    if (n > max) {
      best = t;
      max = n;
    }
  }
  return max >= stories * 0.25 ? best : null;
}

/**
 * Greedy clustering: biggest hotspots seed clusters, smaller ones within
 * `radiusDeg` join the nearest seed. Cluster position is the story-weighted
 * centroid. radiusDeg <= 0 returns one cluster per hotspot.
 */
export function clusterHotspots(hotspots: Hotspot[], radiusDeg: number): Cluster[] {
  const sorted = [...hotspots].sort((a, b) => b.count - a.count);
  if (radiusDeg <= 0) {
    return sorted.map((h) => ({ id: h.id, lat: h.lat, lng: h.lng, count: h.count, topic: h.topic, members: [h] }));
  }
  const seeds: { h: Hotspot; members: Hotspot[] }[] = [];
  for (const h of sorted) {
    let nearest: (typeof seeds)[number] | null = null;
    let nearestD = radiusDeg;
    for (const s of seeds) {
      const d = angularDistance(h.lat, h.lng, s.h.lat, s.h.lng);
      if (d <= nearestD) {
        nearest = s;
        nearestD = d;
      }
    }
    if (nearest) nearest.members.push(h);
    else seeds.push({ h, members: [h] });
  }
  return seeds.map(({ h, members }) => {
    if (members.length === 1) return { id: h.id, lat: h.lat, lng: h.lng, count: h.count, topic: h.topic, members };
    // Weighted centroid via unit vectors, so clusters across the antimeridian behave.
    let x = 0, y = 0, z = 0, count = 0;
    for (const m of members) {
      const la = m.lat * RAD, lo = m.lng * RAD;
      x += Math.cos(la) * Math.cos(lo) * m.count;
      y += Math.cos(la) * Math.sin(lo) * m.count;
      z += Math.sin(la) * m.count;
      count += m.count;
    }
    return {
      id: `c:${h.id}`,
      lat: Math.atan2(z, Math.hypot(x, y)) / RAD,
      lng: Math.atan2(y, x) / RAD,
      count,
      topic: dominantTopic(members),
      members,
    };
  });
}

/** Cluster radius for a camera altitude (globe radii). Below ~0.35 nothing merges. */
export function clusterRadiusForAltitude(altitude: number): number {
  return altitude < 0.35 ? 0 : altitude * 3.2;
}
