"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { MeshBasicMaterial, MeshPhongMaterial, Color } from "three";
import { getCountries } from "@/lib/countries";
import { CYAN, withAlpha } from "@/lib/theme";

const AUTO_ROTATE_SPEED = 0.35;
const RESUME_ROTATE_AFTER_MS = 6000;

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

export default function GlobeView() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const reducedMotion = usePrefersReducedMotion();

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

  // Country caps are invisible for now (they carry the glow layer later).
  // They must not write depth, or they hide the dot matrix underneath.
  const capMaterial = useMemo(
    () => new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    [],
  );

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
    const altitude = aspect < 1 ? Math.min(2.4 / aspect, 4.2) * 0.85 : 2.4;
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
          hexPolygonColor={() => withAlpha(CYAN, 0.65)}
          hexPolygonsTransitionDuration={0}
          // Country outlines
          polygonsData={countries}
          polygonAltitude={0.003}
          polygonCapMaterial={capMaterial}
          polygonSideMaterial={capMaterial}
          polygonStrokeColor={() => withAlpha(CYAN, 0.7)}
          polygonsTransitionDuration={0}
          // Graticule
          pathsData={graticule}
          pathPoints="coords"
          pathPointLat={(p: [number, number]) => p[0]}
          pathPointLng={(p: [number, number]) => p[1]}
          pathColor={() => withAlpha(CYAN, 0.08)}
          pathTransitionDuration={0}
        />
      )}
    </div>
  );
}
