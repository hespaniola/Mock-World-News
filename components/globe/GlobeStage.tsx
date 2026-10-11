"use client";

import dynamic from "next/dynamic";

// three.js needs `window`; keep the globe client-only.
const GlobeView = dynamic(() => import("./GlobeView"), { ssr: false });

export default function GlobeStage() {
  return <GlobeView />;
}
