import { ago } from "./format";
import type { Place } from "./types";
import type { LiveWait } from "@/state/store";

/** A live wait posted by the business in the last 3 hours, if any. */
export function liveWait(p: Place, live: Record<string, LiveWait>): LiveWait | null {
  const w = live[p.id];
  if (!w || typeof w.minutes !== "number") return null;
  if (Date.now() - (w.at || 0) > 3 * 3600e3) return null;
  return w;
}

/** Minutes used by the "under N min" wait filter: live wait first, else the researched busy-time maximum. */
export function waitVal(p: Place, live: Record<string, LiveWait>): number | null {
  const lw = liveWait(p, live);
  if (lw) return lw.minutes;
  const w = p.wait;
  return w && typeof w.typical_wait_max === "number" ? w.typical_wait_max + (w.over ? 1 : 0) : null;
}

export function waitSummary(p: Place, live: Record<string, LiveWait>): { live?: boolean; t: string; sub?: string } | null {
  if (p.status === "closed_permanently" || p.status === "moved") return null;
  const lw = liveWait(p, live);
  if (lw)
    return {
      live: true,
      t: lw.minutes === 0 ? "No wait right now" : `~${lw.minutes}${lw.minutes >= 60 ? "+" : ""} min wait now`,
      sub: "Posted by the business " + ago(lw.at),
    };
  const w = p.wait;
  if (!w) return null;
  const sub = [w.peak ? "Busiest: " + w.peak : null, w.offpeak_tip].filter(Boolean).join(" · ");
  if (w.typical_wait_max)
    return { t: `Usually ${w.typical_wait_min ?? 0}–${w.typical_wait_max}${w.typical_wait_max >= 60 || w.over ? "+" : ""} min at busy times`, sub };
  if (w.popular) return { t: "Popular · expect a line at busy times", sub };
  return null;
}
