// GDELT 2.0 Events export: tab-separated, 61 columns, one event per line.
// Only the ActionGeo fields are used here, to count where events happen.
const COL = {
  actionGeoType: 51,
  actionGeoCountry: 53,
  actionGeoLat: 56,
  actionGeoLng: 57,
} as const;

export type CountryCounts = {
  /** Event rows per FIPS country code. */
  counts: Record<string, number>;
  /** A representative point per FIPS code (country centroid when available). */
  points: Record<string, [number, number]>;
  total: number;
};

export function parseEvents(text: string): CountryCounts {
  const counts: Record<string, number> = {};
  const points: Record<string, [number, number]> = {};
  let total = 0;
  for (const line of text.split("\n")) {
    if (!line) continue;
    const f = line.split("\t");
    if (f.length < 61) continue;
    const cc = f[COL.actionGeoCountry];
    if (!cc) continue;
    counts[cc] = (counts[cc] ?? 0) + 1;
    total++;
    const lat = Number(f[COL.actionGeoLat]);
    const lng = Number(f[COL.actionGeoLng]);
    // Type 1 = whole-country geocode, i.e. GDELT's country centroid.
    if (Number.isFinite(lat) && Number.isFinite(lng) && (!points[cc] || f[COL.actionGeoType] === "1")) {
      points[cc] = [lat, lng];
    }
  }
  return { counts, points, total };
}
