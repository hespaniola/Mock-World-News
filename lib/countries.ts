import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import world from "world-atlas/countries-110m.json";

export type CountryProps = { name: string };
export type CountryFeature = Feature<Geometry, CountryProps>;

let cache: CountryFeature[] | null = null;

function ringArea(ring: Position[]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return Math.abs(a / 2);
}

// The 110m dataset contains zero-area sliver polygons (e.g. one in North
// Korea) that make H3 polyfill throw, so drop them.
function dropDegenerate(f: CountryFeature): CountryFeature | null {
  const g = f.geometry;
  if (g.type === "Polygon") return ringArea(g.coordinates[0]) > 1e-6 ? f : null;
  if (g.type === "MultiPolygon") {
    const coordinates = g.coordinates.filter((p) => ringArea(p[0]) > 1e-6);
    if (coordinates.length === 0) return null;
    return { ...f, geometry: { type: "MultiPolygon", coordinates } };
  }
  return f;
}

/** Natural Earth 1:110m country polygons as GeoJSON (Antarctica dropped). */
export function getCountries(): CountryFeature[] {
  if (cache) return cache;
  const topo = world as unknown as Topology<{ countries: GeometryCollection<CountryProps> }>;
  const fc = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, CountryProps>;
  cache = fc.features
    .filter((f) => f.geometry && f.properties.name !== "Antarctica")
    .map(dropDegenerate)
    .filter((f): f is CountryFeature => f !== null);
  return cache;
}
