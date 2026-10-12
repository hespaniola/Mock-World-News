"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import {
  AdditiveBlending,
  Color,
  Group,
  MeshBasicMaterial,
  MeshPhongMaterial,
  Sprite,
  SpriteMaterial,
  type Object3D,
} from "three";
import { geoArea, geoCentroid } from "d3-geo";
import { getCountries, type CountryFeature } from "@/lib/countries";
import { CYAN, topicColor, withAlpha } from "@/lib/theme";
import type { NewsSnapshot } from "@/lib/news/types";
import { clusterHotspots, clusterRadiusForAltitude, type Cluster } from "@/lib/news/cluster";
import { dotMaterial, getHaloTexture, labelSprite } from "./sprites";

const AUTO_ROTATE_SPEED = 0.35;
const RESUME_ROTATE_AFTER_MS = 6000;
const DEFAULT_ALTITUDE = 2.4;
const GLOW_COLOR = "#8ff0ff";
/** Glow fades out between these camera altitudes (globe radii). */
const GLOW_FADE_FROM = 1.6;
const GLOW_FADE_TO = 0.6;
/** Pulse rings only on the biggest clusters, to keep the frame budget. */
const MAX_RINGS = 60;
const GLOBE_RADIUS = 100;

type GraticuleLine = { coords: [number, number][] };

// Lat/lng grid every 15°, drawn as thin paths so it can take the HUD cyan.
function buildGraticule(): GraticuleLine[] {
  const lines: GraticuleLine[] = [];
  for (let lng = -180; lng < 180; lng += 15) {
    const coords: [number, number][] = [];
    for (let lat = -80; lat <= 80; lat += 4) coords.push([lat, lng]);
    lines.push({ coords });
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    const coords: [number, number][] = [];
    for (let lng = -180; lng <= 180; lng += 4) coords.push([lat, lng]);
    lines.push({ coords });
  }
  return lines;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function glowFade(altitude: number): number {
  const t = (altitude - GLOW_FADE_TO) / (GLOW_FADE_FROM - GLOW_FADE_TO);
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/** Dot size in world units at the default altitude; grows with log(story count). */
function dotSize(count: number): number {
  return 1.6 + 1.6 * Math.log2(1 + count);
}

/** Keeps dots roughly constant on screen as the camera moves in and out. */
function zoomScale(altitude: number): number {
  return (1 + altitude) / (1 + DEFAULT_ALTITUDE);
}

/** Quantised cluster radius so zooming only reclusters at a few thresholds. */
function clusterBucket(altitude: number): number {
  const r = clusterRadiusForAltitude(altitude);
  return r === 0 ? 0 : Math.round(Math.log(r) / Math.log(1.3));
}

function radiusForBucket(bucket: number): number {
  return bucket === 0 ? 0 : Math.pow(1.3, bucket);
}

type Halo = { id: string; lat: number; lng: number; size: number };

export default function GlobeView({ snapshot }: { snapshot: NewsSnapshot | null }) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const reducedMotion = usePrefersReducedMotion();
  const altitudeRef = useRef(DEFAULT_ALTITUDE);
  const [bucket, setBucket] = useState(() => clusterBucket(DEFAULT_ALTITUDE));

  const countries = useMemo(() => getCountries(), []);
  const graticule = useMemo(() => buildGraticule(), []);

  const globeMaterial = useMemo(
    () =>
      new MeshPhongMaterial({
        color: new Color("#03101a"),
        emissive: new Color("#021a26"),
        emissiveIntensity: 0.6,
        shininess: 4,
      }),
    [],
  );

  // ---- Layer 1: country glow -------------------------------------------
  // Each country gets its own additive cap material (a flat wash of light)
  // and, when lit, a soft halo sprite. Opacity is set imperatively so zoom
  // fades never re-render React. Caps must not write depth, or they hide
  // the dot matrix underneath.
  const capMaterials = useMemo(() => {
    const m = new Map<string, MeshBasicMaterial>();
    for (const f of countries) {
      m.set(
        String(f.id),
        new MeshBasicMaterial({
          color: new Color(GLOW_COLOR),
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      );
    }
    return m;
  }, [countries]);
  const sideMaterial = useMemo(
    () => new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    [],
  );

  const intensity = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of snapshot?.countries ?? []) m.set(c.id, c.intensity);
    return m;
  }, [snapshot]);

  // Centroid and apparent size of every country, for halo placement.
  const countryGeometry = useMemo(() => {
    const m = new Map<string, { lat: number; lng: number; size: number }>();
    for (const f of countries) {
      const [lng, lat] = geoCentroid(f);
      const angularRadius = Math.sqrt(geoArea(f) / Math.PI);
      const size = Math.max(8, Math.min(80, 2.6 * angularRadius * GLOBE_RADIUS));
      m.set(String(f.id), { lat, lng, size });
    }
    return m;
  }, [countries]);

  const halos = useMemo<Halo[]>(() => {
    const out: Halo[] = [];
    for (const [id, i] of intensity) {
      const g = countryGeometry.get(id);
      if (g && i > 0.05) out.push({ id, ...g });
    }
    return out;
  }, [intensity, countryGeometry]);

  const haloMaterials = useRef(new Map<string, SpriteMaterial>());

  const applyGlow = useCallback(() => {
    const fade = glowFade(altitudeRef.current);
    for (const [id, mat] of capMaterials) mat.opacity = (intensity.get(id) ?? 0) * 0.3 * fade;
    for (const [id, mat] of haloMaterials.current) mat.opacity = (intensity.get(id) ?? 0) * 0.8 * fade;
  }, [capMaterials, intensity]);

  useEffect(applyGlow, [applyGlow, halos]);

  // Lit countries also brighten their part of the dot matrix.
  const hexColor = useCallback(
    (f: object) => {
      const i = intensity.get(String((f as CountryFeature).id)) ?? 0;
      return withAlpha(CYAN, 0.6 + 0.25 * i);
    },
    [intensity],
  );

  // ---- Layer 2: city / region dots --------------------------------------
  const dotGroups = useRef(new Set<Group>());

  const clusters = useMemo<Cluster[]>(() => {
    dotGroups.current = new Set();
    return snapshot ? clusterHotspots(snapshot.hotspots, radiusForBucket(bucket)) : [];
  }, [snapshot, bucket]);

  const rings = useMemo(() => (reducedMotion ? [] : clusters.slice(0, MAX_RINGS)), [clusters, reducedMotion]);
  const ringScale = Math.min(1, Math.max(0.2, radiusForBucket(bucket) / clusterRadiusForAltitude(DEFAULT_ALTITUDE)));

  const makeDot = useCallback((d: object) => {
    const c = d as Cluster;
    const group = new Group();
    const dot = new Sprite(dotMaterial(topicColor(c.topic)));
    dot.scale.setScalar(dotSize(c.count));
    group.add(dot);
    if (c.members.length > 1) {
      const label = labelSprite(c.count.toLocaleString("en-US"));
      const h = 3.2;
      label.scale.set(h * label.userData.aspect, h, 1);
      // Anchor the label up and to the right of the dot, in screen space.
      label.center.set(-0.12 * (dotSize(c.count) / h), -0.1);
      label.renderOrder = 2;
      group.add(label);
    }
    group.scale.setScalar(zoomScale(altitudeRef.current));
    dotGroups.current.add(group);
    return group;
  }, []);

  const makeHalo = useCallback((d: object) => {
    const h = d as Halo;
    let mat = haloMaterials.current.get(h.id);
    if (!mat) {
      mat = new SpriteMaterial({
        map: getHaloTexture(),
        color: new Color(GLOW_COLOR),
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      });
      haloMaterials.current.set(h.id, mat);
    }
    mat.opacity = (intensity.get(h.id) ?? 0) * 0.8 * glowFade(altitudeRef.current);
    const s = new Sprite(mat);
    s.scale.setScalar(h.size);
    return s;
  }, [intensity]);

  const placeHalo = useCallback((obj: Object3D, d: object) => {
    const h = d as Halo;
    const p = globeRef.current?.getCoords(h.lat, h.lng, 0.01);
    if (p) obj.position.set(p.x, p.y, p.z);
  }, []);

  const onZoom = useCallback(
    ({ altitude }: { altitude: number }) => {
      altitudeRef.current = altitude;
      applyGlow();
      const k = zoomScale(altitude);
      for (const g of dotGroups.current) g.scale.setScalar(k);
      const b = clusterBucket(altitude);
      setBucket((prev) => (prev === b ? prev : b));
    },
    [applyGlow],
  );

  // ---- Sizing and camera -------------------------------------------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Slow auto-rotation that pauses while the user drags/zooms and resumes
  // after a few idle seconds. Disabled entirely under reduced motion.
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || size.width === 0) return;
    const controls = globe.controls();
    controls.autoRotate = !reducedMotion;
    controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    let resumeTimer: ReturnType<typeof setTimeout> | undefined;
    const onStart = () => {
      clearTimeout(resumeTimer);
      controls.autoRotate = false;
    };
    const onEnd = () => {
      clearTimeout(resumeTimer);
      if (reducedMotion) return;
      resumeTimer = setTimeout(() => (controls.autoRotate = true), RESUME_ROTATE_AFTER_MS);
    };
    controls.addEventListener("start", onStart);
    controls.addEventListener("end", onEnd);
    return () => {
      clearTimeout(resumeTimer);
      controls.removeEventListener("start", onStart);
      controls.removeEventListener("end", onEnd);
    };
  }, [reducedMotion, size.width]);

  const onGlobeReady = () => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Pull the camera back on portrait screens so the whole globe fits.
    const el = containerRef.current;
    const aspect = el ? el.clientWidth / Math.max(el.clientHeight, 1) : 1;
    const altitude = aspect < 1 ? Math.min(DEFAULT_ALTITUDE / aspect, 4.2) * 0.85 : DEFAULT_ALTITUDE;
    globe.pointOfView({ lat: 20, lng: 10, altitude }, 0);
  };

  return (
    <div ref={containerRef} className="absolute inset-0">
      {size.width > 0 && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          rendererConfig={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          onGlobeReady={onGlobeReady}
          onZoom={onZoom}
          globeMaterial={globeMaterial}
          showAtmosphere
          atmosphereColor={CYAN}
          atmosphereAltitude={0.2}
          // Dot-matrix landmass
          hexPolygonsData={countries}
          hexPolygonResolution={3}
          hexPolygonMargin={0.5}
          hexPolygonUseDots
          hexPolygonAltitude={0.006}
          hexPolygonColor={hexColor}
          hexPolygonsTransitionDuration={0}
          // Country outlines + glow wash
          polygonsData={countries}
          polygonAltitude={0.003}
          polygonCapMaterial={(f: object) => capMaterials.get(String((f as CountryFeature).id))!}
          polygonSideMaterial={sideMaterial}
          polygonStrokeColor={() => withAlpha(CYAN, 0.7)}
          polygonsTransitionDuration={0}
          // Graticule
          pathsData={graticule}
          pathPoints="coords"
          pathPointLat={(p: [number, number]) => p[0]}
          pathPointLng={(p: [number, number]) => p[1]}
          pathColor={() => withAlpha(CYAN, 0.08)}
          pathTransitionDuration={0}
          // Country glow halos
          customLayerData={halos}
          customThreeObject={makeHalo}
          customThreeObjectUpdate={placeHalo}
          // News dots
          objectsData={clusters}
          objectLat="lat"
          objectLng="lng"
          objectAltitude={0.012}
          objectFacesSurfaces={false}
          objectThreeObject={makeDot}
          // Pulse rings
          ringsData={rings}
          ringLat="lat"
          ringLng="lng"
          ringAltitude={0.008}
          ringColor={(d: object) => {
            const color = topicColor((d as Cluster).topic);
            return (t: number) => withAlpha(color, 0.7 * (1 - t));
          }}
          ringMaxRadius={(d: object) => (0.8 + 0.6 * Math.log2(1 + (d as Cluster).count)) * ringScale}
          ringPropagationSpeed={0.6 * ringScale}
          ringRepeatPeriod={3200}
        />
      )}
    </div>
  );
}
