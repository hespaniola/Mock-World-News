import type { Topic } from "@/lib/theme";

// GKG theme prefixes that signal each topic. A theme matches when it equals
// or starts with one of these. Order inside a list doesn't matter.
const RULES: Record<Topic, string[]> = {
  conflict: [
    "ARMEDCONFLICT", "MILITARY", "KILL", "TERROR", "WOUND", "REBELLION", "INSURGENCY",
    "CEASEFIRE", "PEACEKEEPING", "SEIGE", "BLOCKADE", "MILITARY_COOPERATION", "WMD",
    "TAX_WEAPONS", "SECURITY_SERVICES", "WB_2432_FRAGILITY_CONFLICT_AND_VIOLENCE",
  ],
  economy: [
    "ECON_", "TAX_ECON_", "UNEMPLOYMENT", "WB_1104_MACROECONOMIC", "WB_442_INFLATION",
    "WB_1235_CENTRAL_BANKS", "WB_698_TRADE", "WB_1920_FINANCIAL_SECTOR",
  ],
  politics: [
    "ELECTION", "GENERAL_GOVERNMENT", "LEADER", "LEGISLATION", "DEMOCRACY", "PROTEST",
    "USPEC_POLITICS", "TAX_POLITICAL_PARTY", "GOV_", "IMPEACHMENT", "SOVEREIGNTY",
    "WB_696_PUBLIC_SECTOR_MANAGEMENT",
  ],
  disaster: [
    "NATURAL_DISASTER", "MANMADE_DISASTER", "CRISISLEX_", "DISASTER", "EPIDEMIC",
    "HEALTH_PANDEMIC", "EVACUATION", "WB_2462_POLITICAL_VIOLENCE_AND_WAR_DISASTER",
  ],
};

const TOPICS = Object.keys(RULES) as Topic[];

/**
 * Pick the topic with the most matching themes. Returns null when nothing
 * matches, so general news stays the base cyan.
 */
export function classifyThemes(themes: string[]): Topic | null {
  let best: Topic | null = null;
  let bestScore = 0;
  for (const t of TOPICS) {
    let score = 0;
    for (const theme of themes) {
      for (const rule of RULES[t]) {
        if (theme === rule || theme.startsWith(rule)) {
          score++;
          break;
        }
      }
    }
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best;
}
