"use client";

import dynamic from "next/dynamic";
import type { NewsSnapshot } from "@/lib/news/types";

// three.js needs `window`; keep the globe client-only.
const GlobeView = dynamic(() => import("./GlobeView"), { ssr: false });

export default function GlobeStage({ snapshot }: { snapshot: NewsSnapshot | null }) {
  return <GlobeView snapshot={snapshot} />;
}
