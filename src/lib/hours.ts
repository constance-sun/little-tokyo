import type { DayKey, Hours, Place } from "./types";

/* Opening hours, always in Los Angeles time. */
export const DAYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const DAYN: Record<DayKey, string> = {
  sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday",
};

/** Day index (0 = Sunday) and minutes since midnight, right now in Los Angeles. */
export function laNow(): { d: number; m: number } {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => f.find((x) => x.type === t)!.value;
  let h = +g("hour");
  if (h === 24) h = 0;
  return { d: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(g("weekday")), m: h * 60 + +g("minute") };
}

/** Today's date in LA as YYYY-MM-DD. */
export const laToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

export const toM = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
};

export const fmtT = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  let h = Math.floor(m / 60);
  const mm = m % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return mm ? `${h}:${String(mm).padStart(2, "0")} ${ap}` : `${h} ${ap}`;
};

/** "11:00-14:00, 17:00-21:00" → [[660,840],[1020,1260]]; ranges past midnight extend beyond 1440. */
export function ranges(v: string | undefined | null): [number, number][] {
  if (!v || v === "closed") return [];
  return String(v)
    .split(",")
    .map((r) => r.trim())
    .filter((r) => /^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(r))
    .map((r) => {
      const [a, b0] = r.split("-").map(toM);
      const b = b0 <= a ? b0 + 1440 : b0;
      return [a, b] as [number, number];
    });
}

export type OpenKind = "y" | "n" | "u";
export function openState(p: Pick<Place, "hours" | "hoursNote">): { k: OpenKind; t: string } {
  if (!p.hours) return { k: "u", t: p.hoursNote ? "See hours note" : "Hours not confirmed" };
  const { d, m } = laNow();
  const today = ranges(p.hours[DAYS[d]]);
  const yest = ranges(p.hours[DAYS[(d + 6) % 7]]);
  for (const [, b] of yest) if (b > 1440 && m < b - 1440) return { k: "y", t: "Open · Closes " + fmtT(b) };
  for (const [a, b] of today) if (m >= a && m < b) return { k: "y", t: "Open · Closes " + fmtT(b) };
  for (const [a] of today) if (m < a) return { k: "n", t: "Closed · Opens " + fmtT(a) };
  for (let i = 1; i <= 7; i++) {
    const dd = (d + i) % 7;
    const r = ranges(p.hours[DAYS[dd]]);
    if (r.length) return { k: "n", t: `Closed · Opens ${i === 1 ? "tomorrow" : DAYN[DAYS[dd]].slice(0, 3)} ${fmtT(r[0][0])}` };
  }
  return { k: "n", t: "Closed" };
}

export const isOpen = (p: Pick<Place, "hours" | "hoursNote">) => openState(p).k === "y";

export const hoursText = (v: string | undefined | null) =>
  v == null ? "—" : v === "closed" ? "Closed" : ranges(v).map(([a, b]) => fmtT(a) + " – " + fmtT(b)).join(", ") || String(v);

/** Is the place open at `min` on day `dayIdx`, with 20 minutes to spare? Unknown hours count as open. */
export function openAt(hours: Hours | null | undefined, dayIdx: number, min: number) {
  if (!hours) return true;
  const r = ranges(hours[DAYS[dayIdx]]);
  if (!r.length) return false;
  return r.some(([a, b]) => min >= a && min + 20 <= b);
}
