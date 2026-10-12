"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { NewsState } from "@/hooks/useNews";

function utcTime(iso: string): string {
  return new Date(iso).toISOString().slice(11, 16);
}

/** Bottom-right line showing the real state of the GDELT feed. */
export default function FeedStatus({ news }: { news: NewsState }) {
  let text: string;
  let tone = "text-hud-dim";
  if (news.status === "loading") {
    text = "Connecting to GDELT…";
  } else if (news.status === "error" && !news.snapshot) {
    text = "GDELT feed unavailable · retrying";
    tone = "text-disaster";
  } else {
    const s = news.snapshot!;
    text =
      `GDELT · ${utcTime(s.dataAsOf)} UTC · ` +
      `${s.totalArticles.toLocaleString("en-US")} stories · ${s.hotspots.length.toLocaleString("en-US")} places`;
    if (news.status === "error") {
      text += " · refresh failed";
      tone = "text-conflict";
    }
  }

  return (
    // Under the title on phones (the legend owns the bottom edge), bottom-right otherwise.
    <div className="pointer-events-none absolute left-8 top-[4.25rem] text-[10px] uppercase tracking-[0.2em] sm:left-auto sm:top-auto sm:bottom-9 sm:right-10 sm:text-right">
      <AnimatePresence mode="wait">
        <motion.div
          key={text}
          className={tone}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
        >
          {text}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
