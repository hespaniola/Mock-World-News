"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type GlobeViewType from "./GlobeView";

// three.js needs `window`; keep the globe client-only.
const GlobeView = dynamic(() => import("./GlobeView"), { ssr: false });

export default function GlobeStage(props: ComponentProps<typeof GlobeViewType>) {
  return <GlobeView {...props} />;
}
