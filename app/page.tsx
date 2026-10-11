import GlobeStage from "@/components/globe/GlobeStage";
import HudFrame from "@/components/hud/HudFrame";

export default function Home() {
  return (
    <main className="backdrop relative h-dvh w-screen overflow-hidden">
      <GlobeStage />
      <div className="scanlines pointer-events-none absolute inset-0" />
      <div className="vignette pointer-events-none absolute inset-0" />
      <HudFrame />
    </main>
  );
}
