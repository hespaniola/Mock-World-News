"use client";

import GlobeStage from "@/components/globe/GlobeStage";
import HudFrame from "@/components/hud/HudFrame";
import FeedStatus from "@/components/hud/FeedStatus";
import { useNews } from "@/hooks/useNews";

export default function NewsGlobe() {
  const news = useNews();
  return (
    <>
      <GlobeStage snapshot={news.snapshot} />
      <div className="scanlines pointer-events-none absolute inset-0" />
      <div className="vignette pointer-events-none absolute inset-0" />
      <HudFrame />
      <FeedStatus news={news} />
    </>
  );
}
