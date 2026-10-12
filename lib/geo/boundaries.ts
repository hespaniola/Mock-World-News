import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry, MultiLineString } from "geojson";
import { geoBounds, geoContains } from "d3-geo";

export type ProvinceProps = { name: string; admin: string; type_en: string | null; fips: string | null };
export type Province = Feature<Geometry, ProvinceProps> & { bbox4: [number, number, number, number] };

export type Boundaries = {
  /** Every country border, each shared edge once (1:50m). */
  countryLines: MultiLineString;
  /** State/province borders inside countries only (coasts and country borders excluded). */
  provinceLines: MultiLineString;
  provinces: Province[];
  byFips: Map<string, Province>;
};

let pending: Promise<Boundaries> | null = null;

/** Fetches the boundary files from /public once and builds lookup structures. */
export function loadBoundaries(): Promise<Boundaries> {
  return (pending ??= (async () => {
    const [world, admin1] = await Promise.all([
      fetch("/geo/countries-50m.topo.json").then((r) => r.json()),
      fetch("/geo/admin1.topo.json").then((r) => r.json()),
    ]);
    return buildBoundaries(world, admin1);
  })());
}

export function buildBoundaries(world: unknown, admin1: unknown): Boundaries {
  const w = world as Topology<{ countries: GeometryCollection }>;
  const a = admin1 as Topology<{ admin1: GeometryCollection<ProvinceProps> }>;

  const countryLines = mesh(w, w.objects.countries);
  const provinceLines = mesh(
    a,
    a.objects.admin1,
    (x, y) => x !== y && (x.properties as ProvinceProps).admin === (y.properties as ProvinceProps).admin,
  );

  const fc = feature(a, a.objects.admin1) as FeatureCollection<Geometry, ProvinceProps>;
  const provinces: Province[] = fc.features.map((f) => {
    const [[w0, s0], [e0, n0]] = geoBounds(f);
    return Object.assign(f, { bbox4: [w0, s0, e0, n0] as [number, number, number, number] });
  });
  const byFips = new Map<string, Province>();
  for (const p of provinces) if (p.properties.fips) byFips.set(p.properties.fips, p);
  return { countryLines, provinceLines, provinces, byFips };
}

function inBbox([w, s, e, n]: Province["bbox4"], lat: number, lng: number): boolean {
  if (lat < s || lat > n) return false;
  // Bounds that cross the antimeridian have west > east.
  return w <= e ? lng >= w && lng <= e : lng >= w || lng <= e;
}

/**
 * The state/province a place sits in: GDELT's ADM1 code when it matches
 * Natural Earth's FIPS code, otherwise point-in-polygon.
 */
export function findProvince(b: Boundaries, adm1Code: string, lat: number, lng: number): Province | null {
  const byCode = adm1Code ? b.byFips.get(adm1Code) : undefined;
  if (byCode) return byCode;
  for (const p of b.provinces) {
    if (inBbox(p.bbox4, lat, lng) && geoContains(p, [lng, lat])) return p;
  }
  return null;
}

/** Outer rings of a province, as [lng, lat] lines, for highlighting. */
export function provinceRings(p: Province): [number, number][][] {
  const g = p.geometry;
  if (g.type === "Polygon") return g.coordinates.map((r) => r as [number, number][]);
  if (g.type === "MultiPolygon") return g.coordinates.flatMap((poly) => poly.map((r) => r as [number, number][]));
  return [];
}
