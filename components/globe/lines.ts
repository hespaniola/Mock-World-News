import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineSegments } from "three";

type GetCoords = (lat: number, lng: number, altitude?: number) => { x: number; y: number; z: number };

/**
 * Packs many [lng, lat] polylines into a single LineSegments object (one
 * draw call), lifted `altitude` globe radii above the surface.
 */
export function buildLines(
  lines: number[][][],
  getCoords: GetCoords,
  altitude: number,
  material: LineBasicMaterial,
): LineSegments {
  let segments = 0;
  for (const l of lines) segments += Math.max(0, l.length - 1);
  const pos = new Float32Array(segments * 6);
  let o = 0;
  for (const l of lines) {
    for (let i = 0; i + 1 < l.length; i++) {
      const a = getCoords(l[i][1], l[i][0], altitude);
      const b = getCoords(l[i + 1][1], l[i + 1][0], altitude);
      pos[o++] = a.x; pos[o++] = a.y; pos[o++] = a.z;
      pos[o++] = b.x; pos[o++] = b.y; pos[o++] = b.z;
    }
  }
  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(pos, 3));
  const obj = new LineSegments(geom, material);
  // Borders are decoration; keep them out of click/hover picking.
  obj.raycast = () => {};
  return obj;
}
