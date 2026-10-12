"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import GlobeStage from "@/components/globe/GlobeStage";
import HudFrame from "@/components/hud/HudFrame";
import FeedStatus from "@/components/hud/FeedStatus";
import StoryPanel from "@/components/panel/StoryPanel";
import { useNews } from "@/hooks/useNews";
import { areaFromHotspots, type Area } from "@/lib/news/area";
import type { Cluster } from "@/lib/news/cluster";
import type { Hotspot } from "@/lib/news/types";
import { findProvince, loadBoundaries, type Boundaries } from "@/lib/geo/boundaries";

export default function NewsGlobe() {
  const news = useNews();
  const snapshot = news.snapshot;
  const [selected, setSelected] = useState<Area | null>(null);
  const [boundaries, setBoundaries] = useState<Boundaries | null>(null);

  useEffect(() => {
    loadBoundaries().then(setBoundaries, (e) => console.error("boundary data failed to load", e));
  }, []);

  // When a refresh lands, re-read the open area from the new snapshot so the
  // panel never shows stale numbers; close it if the places dropped out.
  useEffect(() => {
    setSelected((prev) => {
      if (!prev || !snapshot) return prev;
      const ids = new Set(prev.places.map((p) => p.id));
      const fresh = snapshot.hotspots.filter((h) => ids.has(h.id));
      return fresh.length ? areaFromHotspots(fresh, prev.lat, prev.lng) : null;
    });
  }, [snapshot]);

  const onSelectCluster = useCallback((c: Cluster) => setSelected(areaFromHotspots(c.members, c.lat, c.lng)), []);
  const onSelectPlace = useCallback((h: Hotspot) => setSelected(areaFromHotspots([h])), []);
  const onClose = useCallback(() => setSelected(null), []);

  const lead = selected?.places[0];
  const province = useMemo(
    () => (boundaries && lead ? findProvince(boundaries, lead.adm1Code, lead.lat, lead.lng) : null),
    [boundaries, lead],
  );

  const regionLabel = useMemo(() => {
    if (!lead) return null;
    const country = lead.countryName ?? province?.properties.admin ?? lead.name.split(",").at(-1)?.trim() ?? null;
    if (!province) return country;
    const kind = province.properties.type_en ? ` ${province.properties.type_en.toLowerCase()}` : "";
    return `${province.properties.name}${kind} · ${country ?? province.properties.admin}`;
  }, [lead, province]);

  const countrySpike = useMemo(
    () => (lead?.countryId ? snapshot?.countries.find((c) => c.id === lead.countryId) : undefined),
    [lead, snapshot],
  );

  return (
    <>
      <GlobeStage
        snapshot={snapshot}
        selected={selected}
        onSelect={onSelectCluster}
        boundaries={boundaries}
        province={province}
      />
      <div className="scanlines pointer-events-none absolute inset-0" />
      <div className="vignette pointer-events-none absolute inset-0" />
      <HudFrame />
      <FeedStatus news={news} />
      <StoryPanel
        area={selected}
        regionLabel={regionLabel}
        country={countrySpike}
        dataAsOf={snapshot?.dataAsOf ?? null}
        onClose={onClose}
        onSelectPlace={onSelectPlace}
      />
    </>
  );
}
