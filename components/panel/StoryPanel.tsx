"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { TOPIC_COLORS, TOPIC_LABELS, type Topic } from "@/lib/theme";
import { describeArea, shortName, toneLabel, type Area } from "@/lib/news/area";
import type { CountrySpike, Hotspot } from "@/lib/news/types";

type Props = {
  area: Area | null;
  /** e.g. "Kharkiv region · Ukraine", resolved from the boundary data. */
  regionLabel: string | null;
  country: CountrySpike | undefined;
  dataAsOf: string | null;
  onClose: () => void;
  onSelectPlace: (place: Hotspot) => void;
};

function useIsNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setNarrow(mq.matches);
    const on = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

function coords(lat: number, lng: number): string {
  const f = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`;
  return `${f(lat, "N", "S")} ${f(lng, "E", "W")}`;
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return `${h} h ago`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-[10px] uppercase tracking-[0.25em] text-hud-dim">{children}</h3>;
}

function TopicBar({ area }: { area: Area }) {
  const entries = (Object.entries(area.topicCounts) as [Topic, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const other = Math.max(0, area.count - entries.reduce((s, [, n]) => s + n, 0));
  return (
    <div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-hud-faint">
        {entries.map(([t, n]) => (
          <div key={t} style={{ width: `${(n / area.count) * 100}%`, background: TOPIC_COLORS[t] }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-hud/80">
        {entries.map(([t, n]) => (
          <li key={t} className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: TOPIC_COLORS[t] }} />
            {TOPIC_LABELS[t]} <span className="text-hud-dim">{n}</span>
          </li>
        ))}
        {other > 0 && (
          <li className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-hud-dim" />
            Other <span className="text-hud-dim">{other}</span>
          </li>
        )}
      </ul>
    </div>
  );
}

const TONE_RANGE = 10;

function ToneMeter({ tone }: { tone: number }) {
  const pos = ((Math.max(-TONE_RANGE, Math.min(TONE_RANGE, tone)) + TONE_RANGE) / (2 * TONE_RANGE)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="capitalize text-hud">{toneLabel(tone)}</span>
        <span className="text-hud-dim">{tone > 0 ? "+" : ""}{tone.toFixed(1)}</span>
      </div>
      <div className="relative mt-2 h-1.5 rounded-full bg-gradient-to-r from-disaster/70 via-hud-faint to-economy/70">
        <div className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-hud-dim" style={{ left: "50%" }} />
        <motion.div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-void shadow-[0_0_8px_rgba(92,225,255,0.8)]"
          initial={{ left: "50%" }}
          animate={{ left: `${pos}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-hud-dim">
        <span>Negative</span>
        <span>Neutral</span>
        <span>Positive</span>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-hud-dim">
        How positive or negative the wording of these stories is, averaged (GDELT tone, −10 to +10).
      </p>
    </div>
  );
}

export default function StoryPanel({ area, regionLabel, country, dataAsOf, onClose, onSelectPlace }: Props) {
  const narrow = useIsNarrow();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!area) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [area, onClose]);

  const hidden = narrow ? { y: "100%", x: 0 } : { x: "105%", y: 0 };

  return (
    <AnimatePresence>
      {area && (
        <motion.aside
          key="story-panel"
          role="dialog"
          aria-label={`News in ${shortName(area.places[0].name)}`}
          className={
            "pointer-events-auto absolute z-20 flex flex-col border-hud-dim bg-void/85 backdrop-blur-md " +
            (narrow
              ? "inset-x-0 bottom-0 h-[62dvh] rounded-t-xl border-t"
              : "bottom-5 right-5 top-5 w-[400px] border")
          }
          initial={reduce ? { opacity: 0 } : hidden}
          animate={reduce ? { opacity: 1 } : { x: 0, y: 0 }}
          exit={reduce ? { opacity: 0 } : hidden}
          transition={{ type: "spring", stiffness: 260, damping: 32 }}
        >
          {narrow && <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-hud-dim" aria-hidden />}

          {/* Header */}
          <header className="flex items-start justify-between gap-4 border-b border-hud-faint px-5 pb-4 pt-4">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.3em] text-hud-dim">
                {area.places.length > 1 ? `Area · ${area.places.length} places` : "Location"}
              </div>
              <h2 className="mt-1 truncate text-xl font-semibold text-white">{shortName(area.places[0].name)}</h2>
              {regionLabel && <div className="mt-0.5 truncate text-[12px] text-hud">{regionLabel}</div>}
              <div className="mt-1 text-[10px] tracking-wider text-hud-dim">{coords(area.lat, area.lng)}</div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 border border-hud-dim px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-hud transition-colors hover:border-hud hover:bg-hud-faint"
              aria-label="Close panel"
            >
              Close <span className="hidden text-hud-dim sm:inline">Esc</span>
            </button>
          </header>

          {/* Body */}
          <motion.div
            key={area.id}
            className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, delay: 0.1 }}
          >
            <section>
              <SectionLabel>What&apos;s happening</SectionLabel>
              <div className="space-y-1 text-[13px] leading-relaxed text-white/90">
                {describeArea(area, country).map((l) => (
                  <p key={l}>{l}</p>
                ))}
              </div>
            </section>

            <section>
              <SectionLabel>Topics</SectionLabel>
              <TopicBar area={area} />
            </section>

            <section>
              <SectionLabel>Tone</SectionLabel>
              <ToneMeter tone={area.tone} />
            </section>

            {area.places.length > 1 && (
              <section>
                <SectionLabel>Places in this area</SectionLabel>
                <ul className="divide-y divide-hud-faint border-y border-hud-faint">
                  {area.places.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => onSelectPlace(p)}
                        className="flex w-full items-center justify-between gap-3 py-2 text-left text-[12px] text-hud/90 transition-colors hover:bg-hud-faint"
                      >
                        <span className="truncate">{shortName(p.name)}</span>
                        <span className="shrink-0 text-hud-dim">{p.count} {p.count === 1 ? "story" : "stories"} ›</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <SectionLabel>Latest headlines</SectionLabel>
              <ul className="space-y-3">
                {area.articles.slice(0, 12).map((a) => (
                  <li key={a.url}>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block border-l border-hud-faint pl-3 transition-colors hover:border-hud"
                    >
                      <div className="text-[13px] leading-snug text-white/90 group-hover:text-white">{a.title}</div>
                      <div className="mt-1 text-[10px] tracking-wide text-hud-dim">
                        {a.source}
                        {area.places.length > 1 && ` · ${a.place}`} · {timeAgo(a.seenAt)} ↗
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </motion.div>

          {dataAsOf && (
            <footer className="border-t border-hud-faint px-5 py-2 text-[10px] uppercase tracking-[0.2em] text-hud-dim">
              Source: GDELT · data as of {new Date(dataAsOf).toISOString().slice(11, 16)} UTC
            </footer>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
