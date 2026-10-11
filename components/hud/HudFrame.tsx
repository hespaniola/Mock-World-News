"use client";

import { motion } from "framer-motion";
import { TOPIC_COLORS, TOPIC_LABELS, type Topic } from "@/lib/theme";

const CORNER = 22;

function Corner({ className, d }: { className: string; d: string }) {
  return (
    <svg
      width={CORNER}
      height={CORNER}
      viewBox={`0 0 ${CORNER} ${CORNER}`}
      className={`absolute text-hud ${className}`}
      aria-hidden
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.25} />
    </svg>
  );
}

/**
 * Static thin-line frame around the viewport. Readouts (clocks, counts,
 * lists) arrive in the HUD step; nothing here displays a number.
 */
export default function HudFrame() {
  const topics = Object.keys(TOPIC_COLORS) as Topic[];
  const c = CORNER - 0.5;

  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Frame */}
      <div className="absolute inset-3 sm:inset-5">
        <div className="absolute inset-0 border border-hud-faint" />
        <Corner className="left-0 top-0" d={`M0.5 ${c} V0.5 H${c}`} />
        <Corner className="right-0 top-0" d={`M0.5 0.5 H${c} V${c}`} />
        <Corner className="bottom-0 left-0" d={`M0.5 0.5 V${c} H${c}`} />
        <Corner className="bottom-0 right-0" d={`M0.5 ${c} H${c} V0.5`} />

        {/* Edge ticks at the midpoints */}
        <div className="absolute left-1/2 top-0 h-2 w-px -translate-x-1/2 bg-hud-dim" />
        <div className="absolute bottom-0 left-1/2 h-2 w-px -translate-x-1/2 bg-hud-dim" />
        <div className="absolute left-0 top-1/2 h-px w-2 -translate-y-1/2 bg-hud-dim" />
        <div className="absolute right-0 top-1/2 h-px w-2 -translate-y-1/2 bg-hud-dim" />

        {/* Title */}
        <div className="absolute left-5 top-4 sm:left-7 sm:top-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-hud">
            Global News Monitor
          </div>
          <div className="mt-1 h-px w-40 bg-gradient-to-r from-hud-dim to-transparent" />
        </div>

        {/* Topic legend */}
        <ul className="absolute bottom-4 left-5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.2em] text-hud-dim sm:bottom-5 sm:left-7">
          {topics.map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: TOPIC_COLORS[t], boxShadow: `0 0 6px ${TOPIC_COLORS[t]}` }}
              />
              {TOPIC_LABELS[t]}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
