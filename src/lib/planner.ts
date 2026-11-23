import { BY, EVENTS, PLACES, POI, eventVenue } from "./data";
import { DAYS, fmtT, hoursText, laNow, laToday, openAt, openState, toM } from "./hours";
import { nearest, walkM } from "./route";
import { WALK_M_PER_MIN } from "./format";
import { getHost, type ClaudeSample } from "./claude";
import { iterationHas } from "./iterations";
import { getState, setPlan, setSurvey, type Survey } from "@/state/store";
import type { ChatMsg, Place, Plan, PlanStop, Pt } from "./types";

/* ======================================================================
   PLAN A DAY: a short survey builds the day; then edit it by chatting or talking.
   Ported from the original site's planner.
   ====================================================================== */

export const SURVEY_DEF: Record<string, { label: string; icon: string; opts: [string, string][] }> = {
  food: { label: "Food", icon: "dining", opts: [["ramen", "Ramen & noodles"], ["sushi", "Sushi"], ["cafes", "Cafés & sweets"], ["bbq", "Korean BBQ & grill"], ["comfort", "Japanese comfort food"], ["bars", "Bars & drinks"]] },
  shop: { label: "Shopping", icon: "shop", opts: [["gifts", "Gifts & souvenirs"], ["anime", "Anime & manga"], ["fashion", "Fashion & sneakers"], ["books", "Books"], ["home", "Ceramics & home"], ["artcraft", "Art & crafts"]] },
  explore: { label: "Experiences", icon: "temple", opts: [["temples", "Temples & history"], ["museums", "Museums"], ["shows", "Theater & music"], ["plazas", "Plazas & gardens"], ["events", "Events that day"]] },
};

/** Open, usable places (not on the avoid list; skip residential towers and the service center). */
export const usable = (p: Place) => {
  const avoid = getState().avoid;
  return POI(p) && p.status === "open" && !["ltowers", "casaheiwa"].includes(p.id) && !avoid.includes(p.id);
};

export function pickMatches(p: Place, k: string): boolean {
  const g = p.glyphKind;
  const t = ((p.type || "") + " " + p.tags.join(" ") + " " + p.name).toLowerCase();
  switch (k) {
    case "ramen": return g === "ramen";
    case "sushi": return g === "sushi";
    case "cafes": return g === "cafe" || g === "sweets";
    case "bbq": return /bbq|grill|korean/.test(t);
    case "comfort": return /comfort|teishoku|omurice|bento|curry|udon/.test(t) && p.cat === "eat";
    case "bars": return g === "bar" || /drinks/.test(t);
    case "gifts": return (p.cat === "shop" && /gift|souvenir|houseware/.test(t)) || ["bunkado", "rafubussan", "tokyooutlet", "ginza"].includes(p.id);
    case "anime": return /anime|manga|card/.test(t);
    case "fashion": return ["japangeles", "rifla", "hobnob", "popkiller"].includes(p.id) || /cloth|fashion|shoe|sneaker/.test(t);
    case "books": return g === "books" && p.cat === "shop";
    case "home": return /ceramic|houseware|hardware|home/.test(t);
    case "artcraft": return g === "art" && p.cat === "shop";
    case "temples": return g === "temple" || g === "church";
    case "museums": return g === "museum";
    case "shows": return g === "theater" || g === "music";
    case "plazas": return p.id === "jvp" || p.id === "jaccc";
    default: return false;
  }
}

/** The sequence of slot kinds for the chosen length: meals in the middle/end, the rest cycling interests. */
function planSlots(SV: Survey) {
  const n = { short: 3, half: 5, full: 8 }[SV.dur];
  const groups = SV.groups.length ? SV.groups : ["food"];
  const slots: string[] = [];
  const food = groups.includes("food"), shop = groups.includes("shop"), exp = groups.includes("explore");
  const cycle: string[] = [];
  if (exp) cycle.push("explore");
  if (shop) cycle.push("shop");
  if (food && (SV.picks.food || []).includes("cafes")) cycle.push("cafes");
  if (shop) cycle.push("shop");
  if (exp) cycle.push("explore");
  // food only: one or two meals, with a café, a sight and a shop between them (not five meals in a row)
  if (!cycle.length) cycle.push("explore", "cafes", "shop");
  let mealDone = 0;
  const meals = food ? (SV.dur === "full" ? 2 : 1) : 0;
  for (let i = 0; slots.length < n; i++) {
    if (food && mealDone < meals && (slots.length === Math.floor(n / 2) - (meals > 1 ? 1 : 0) || slots.length === n - 1)) {
      slots.push("meal");
      mealDone++;
      continue;
    }
    slots.push(cycle.length ? cycle[i % cycle.length] : "meal");
    if (i > 40) break;
  }
  return slots.slice(0, n);
}

function slotFits(SV: Survey, slot: string, p: Place) {
  const picks = SV.picks;
  const foodNoCafe = (picks.food || []).filter((k) => k !== "cafes");
  const expNoEv = (picks.explore || []).filter((k) => k !== "events");
  if (slot === "meal") return p.cat === "eat" && p.glyphKind !== "sweets" && p.glyphKind !== "cafe" && (foodNoCafe.some((k) => pickMatches(p, k)) || !foodNoCafe.length);
  if (slot === "cafes") return p.cat === "eat" && (p.glyphKind === "cafe" || p.glyphKind === "sweets");
  if (slot === "shop") return p.cat === "shop" && ((picks.shop || []).some((k) => pickMatches(p, k)) || !(picks.shop || []).length);
  if (slot === "explore") return p.cat === "explore" && (expNoEv.some((k) => pickMatches(p, k)) || !expNoEv.length);
  return false;
}

let seed = 7;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

export const planDay = (SV: Survey = getState().survey) => {
  const d = SV.date ? new Date(SV.date + "T12:00:00") : null;
  return d ? d.getDay() : laNow().d;
};

export const parkPrice = (p: Place) => {
  const r = (p.rateList || []).map((x) => parseFloat(String(x.price).replace(/[^0-9.]/g, ""))).filter((x) => !isNaN(x));
  return r.length ? Math.max(...r) : null;
};

function choosePark(SV: Survey, near: Place) {
  const lots = PLACES.filter((q) => q.cat === "park" && q.status !== "unknown" && !/valet|church|catholic/i.test(q.name));
  if (!lots.length) return null;
  if (SV.parkPref === "cheap") {
    const priced = lots.filter((q) => parkPrice(q) != null);
    if (priced.length) {
      priced.sort((a, b) => parkPrice(a)! - parkPrice(b)! || Math.hypot(a.x - near.x, a.y - near.y) - Math.hypot(b.x - near.x, b.y - near.y));
      return priced[0];
    }
  }
  return nearest(near, lots)?.p ?? null;
}

function whyText(SV: Survey, p: Place) {
  const b: string[] = [];
  if (p.legacy) b.push(p.since ? `Legacy business since ${p.since}.` : "Little Tokyo legacy business.");
  const chosen = Object.values(SV.picks).flat();
  const pk = Object.values(SURVEY_DEF)
    .flatMap((g) => g.opts)
    .filter(([k]) => chosen.includes(k) && pickMatches(p, k))
    .map((o) => o[1].toLowerCase());
  if (pk.length) b.push("You picked " + pk.slice(0, 2).join(" and ") + ".");
  if (p.desc) b.push(p.desc.split(/(?<=\.)\s/)[0]);
  return b.join(" ");
}

/** Build a day from the survey: greedy best-scoring open place per slot, near the previous stop. */
export function quickPlan(shuffle?: boolean): Plan {
  const SV = getState().survey;
  if (shuffle) seed = (Date.now() % 99991) + 3;
  const slots = planSlots(SV);
  const used = new Set<string>();
  const out: PlanStop[] = [];
  let t = toM(SV.start || "11:00");
  const day = planDay(SV);
  // events that day at a known venue
  const evStops: { e: (typeof EVENTS)[number]; v: Place }[] = [];
  if (SV.groups.includes("explore") && (SV.picks.explore || []).includes("events")) {
    const iso = SV.date || laToday();
    EVENTS.filter((e) => iso >= e.start && iso <= (e.end || e.start)).forEach((e) => {
      const v = eventVenue(e);
      if (v && usable(v)) evStops.push({ e, v });
    });
  }
  let prev: Pt = getState().me;
  // chat Guide: if nothing matching the picks is open for a slot, take any open place of that kind rather than drop the stop
  const relax = iterationHas(getState().iteration, "chatGuide");
  for (const s of slots) {
    let best: Place | null = null, bs = -1e9;
    for (const loose of relax ? [false, true] : [false]) {
      for (const p of PLACES) {
        if (!usable(p) || used.has(p.id) || !(loose ? slotFits({ ...SV, picks: {} }, s, p) : slotFits(SV, s, p))) continue;
        const wm = walkM(prev, p);
        if (!openAt(p.hours, day, t + wm / WALK_M_PER_MIN)) continue;
        const score = (p.legacy && SV.legacy ? 2.5 : 0) + (p.photos.length ? 0.4 : 0) - wm / 220 + rnd() * 1.4 + (p.wait && p.wait.popular ? 0.3 : 0);
        if (score > bs) { bs = score; best = p; }
      }
      if (best) break;
    }
    if (!best) continue;
    used.add(best.id);
    const wm = walkM(prev, best);
    t += Math.round(wm / WALK_M_PER_MIN);
    const stay = s === "meal" ? 60 : s === "cafes" ? 20 : s === "shop" ? 25 : 45;
    out.push({ id: best.id, time: fmtT(t), minutes: stay, why: whyText(SV, best) });
    t += stay;
    prev = best;
  }
  evStops.slice(0, 1).forEach(({ e, v }) => {
    if (!out.some((s) => s.id === v.id)) out.splice(Math.min(out.length, 2), 0, { id: v.id, time: e.time || "", minutes: 60, why: `Event that day: ${e.title}.` });
  });
  const park = SV.travel === "drive" && SV.parkInPlan && out.length ? choosePark(SV, BY[out[0].id]) : null;
  return {
    title: { short: "A quick taste of Little Tokyo", half: "An afternoon in Little Tokyo", full: "A full day in Little Tokyo" }[SV.dur],
    stops: out,
    park: park ? park.id : null,
    date: SV.date,
  };
}

/* ---------------- offline "AI": keyword edits to the survey, then rebuild ---------------- */
const KW: [string, string, RegExp][] = [
  ["food", "ramen", /ramen|noodle|udon/], ["food", "sushi", /sushi|sashimi|fish/], ["food", "cafes", /sweet|mochi|dessert|ice cream|coffee|tea|matcha|boba|cafe/],
  ["food", "bbq", /bbq|barbecue|grill|korean/], ["food", "bars", /bar|beer|sake|drink|cocktail/],
  ["shop", "gifts", /gift|souvenir/], ["shop", "anime", /anime|manga|figure|cards?/], ["shop", "fashion", /fashion|cloth|sneaker|shoe/], ["shop", "books", /book/],
  ["shop", "home", /ceramic|bowl|home|kitchen/], ["explore", "temples", /temple|history|heritage|church/], ["explore", "museums", /museum/],
  ["explore", "shows", /theater|theatre|music|show|concert/], ["explore", "events", /event|festival/],
];

/* ---------------- "a couple of ideas" instead of a whole day ---------------- */
const SUGGEST_RE = /\b(suggest|suggestions?|recommend|recommendations?|ideas?|options?|where (should|can|could|do) (i|we)|where to|any good|what'?s good|best|a place|one place|somewhere|a spot|spots?|places? (for|to)|grab|bite|something to (eat|drink)|nearest|closest|cheap(est)? parking|where can i park|restroom|bathroom|toilet|hungry|thirsty|what should (i|we)|what to (see|do|eat)|what'?s (around|nearby|here))\b/;
const PLAN_RE = /\b(plan|itinerary|schedule|day|afternoon|morning|evening|hours?|trip|visit|route|quick taste|stops)\b/;

/** Is this a request for a few places rather than a plan? (A plan in progress is edited unless they ask for ideas.) */
export function wantsPicks(text: string): boolean {
  const t = text.toLowerCase();
  if (PLAN_RE.test(t) && !/\b(a|one|two|couple|few) (place|spot|idea|suggestion)/.test(t)) return false;
  if (SUGGEST_RE.test(t)) return true;
  // with no plan yet, a bare "ramen?" / "sushi near me" is a request for places too
  return !getState().plan && KW.some(([, , re]) => re.test(t));
}

const pickCount = (t: string) =>
  /\b(one|a single|a place|one place|somewhere|a spot|the best|nearest|closest)\b/.test(t) ? 1 : /\b(couple|two|2|pair)\b/.test(t) ? 2 : 3;

/** Rank places for a "where should I…" request: matching kind, open now, close by, legacy and photos help. */
export function suggest(text: string): { ids: string[]; what: string } {
  const t = text.toLowerCase();
  const { me } = getState();
  const keys: string[] = [];
  for (const [, k, re] of KW) {
    const m = t.match(re);
    if (m && m.index != null && !/(no|not|don'?t|without|avoid)\s+(\w+\s){0,2}$/.test(t.slice(Math.max(0, m.index - 18), m.index) + " ")) keys.push(k);
  }
  let pool: Place[];
  let what: string;
  if (/\b(park|parking|garage|lot)\b/.test(t) && !/\b(plaza|garden)\b/.test(t)) {
    pool = PLACES.filter((q) => q.cat === "park" && q.status !== "unknown" && !/valet|church|catholic/i.test(q.name));
    if (/cheap|budget|free/.test(t)) {
      const priced = pool.filter((q) => parkPrice(q) != null).sort((a, b) => parkPrice(a)! - parkPrice(b)!);
      if (priced.length) return { ids: priced.slice(0, pickCount(t)).map((q) => q.id), what: "cheap parking" };
    }
    what = "parking";
  } else if (/\b(restroom|bathroom|toilet|wc)\b/.test(t)) {
    pool = PLACES.filter((q) => q.cat === "wc");
    what = "restroom";
  } else {
    pool = PLACES.filter(usable);
    if (keys.length) {
      pool = pool.filter((q) => keys.some((k) => pickMatches(q, k)));
      what = keys.map((k) => Object.values(SURVEY_DEF).flatMap((d) => d.opts).find(([kk]) => kk === k)?.[1].toLowerCase() || k).join(" or ");
    } else if (/\b(food|eat|lunch|dinner|breakfast|hungry|restaurants?|bite)\b/.test(t)) {
      pool = pool.filter((q) => q.cat === "eat");
      what = "food";
    } else if (/\b(shop|shops|shopping|stores?|buy)\b/.test(t)) {
      pool = pool.filter((q) => q.cat === "shop");
      what = "shopping";
    } else if (/\b(see|sights?|do|explore|history|culture|around|nearby)\b/.test(t)) {
      pool = pool.filter((q) => q.cat === "explore");
      what = "things to see";
    } else what = "places";
  }
  const scored = pool.map((q) => {
    const st = POI(q) ? openState(q).k : "y";
    const score = (st === "y" ? 2 : st === "n" ? -1.5 : 0) + (q.legacy ? 0.8 : 0) + (q.photos.length ? 0.4 : 0) + (q.wait && q.wait.popular ? 0.3 : 0) - walkM(me, q) / 300;
    return { q, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return { ids: scored.slice(0, pickCount(t)).map((x) => x.q.id), what };
}

function picksReply(text: string): ChatMsg {
  const { ids, what } = suggest(text);
  if (!ids.length) return { role: "assistant", text: `I couldn't find ${what} open in Little Tokyo right now. Want me to look for something else?` };
  const names = ids.map((id) => BY[id].name);
  const lead =
    ids.length === 1
      ? `Try ${names[0]}.`
      : `Here are ${ids.length === 2 ? "two" : "a few"} ideas${what === "places" ? "" : " for " + what}, open and close by.`;
  return { role: "assistant", text: lead + (ids.length === 1 ? " Tap it for details" : " Tap one for details") + ", or ask me to build a day around it.", picks: ids };
}

const GROUP_KW: [string, RegExp][] = [
  ["food", /\b(food|eat|eating|lunch|dinner|restaurants?)\b/],
  ["shop", /\b(shop|shops|shopping|stores?)\b/],
  ["explore", /\b(sights|sightseeing|explore|culture|history|museums?|temples?)\b/],
];

export function offlineReply(text: string): ChatMsg {
  if (iterationHas(getState().iteration, "chatGuide") && wantsPicks(text)) return picksReply(text);
  const t = text.toLowerCase();
  const changed: string[] = [];
  const cur0 = getState().survey;
  const chatOnly = iterationHas(getState().iteration, "chatGuide");
  const first = !getState().plan;
  // chat-only Guide: a new conversation starts from a blank slate, not old survey answers
  const fresh = chatOnly && first;
  const SV: Survey = fresh ? { ...cur0, picks: {}, groups: [] } : { ...cur0, picks: { ...cur0.picks }, groups: [...cur0.groups] };
  const negated = (i: number) => /(no|not|don'?t|hate|less|without|skip|avoid)\s+(\w+\s){0,2}$/.test(t.slice(Math.max(0, i - 18), i) + " ");
  // whole groups ("shopping", "no food")
  for (const [g, re] of GROUP_KW) {
    const m = t.match(re);
    if (!m || m.index == null) continue;
    if (negated(m.index)) {
      if (SV.groups.includes(g)) { SV.groups = SV.groups.filter((x) => x !== g); SV.picks[g] = []; changed.push("no " + SURVEY_DEF[g].label.toLowerCase()); }
    } else if (!SV.groups.includes(g)) { SV.groups.push(g); changed.push(SURVEY_DEF[g].label.toLowerCase()); }
  }
  for (const [g, k, re] of KW) {
    const m = t.match(re);
    if (!m || m.index == null) continue;
    const cur = SV.picks[g] || [];
    if (negated(m.index)) {
      if (cur.includes(k)) { SV.picks[g] = cur.filter((x) => x !== k); changed.push("no " + k); }
    } else {
      if (!cur.includes(k)) SV.picks[g] = [...cur, k];
      if (!SV.groups.includes(g)) SV.groups.push(g);
      changed.push(k);
    }
  }
  if (fresh && !SV.groups.length) { SV.groups = [...cur0.groups]; SV.picks = { ...cur0.picks }; }
  if (/half (a )?day|afternoon|morning|few hours/.test(t)) SV.dur = "half";
  if (/full day|all day/.test(t)) SV.dur = "full";
  if (/quick|short|couple hours|2 hours/.test(t)) SV.dur = "short";
  if (/drive|driving|car|park/.test(t) && !/no car|not driving/.test(t)) SV.travel = "drive";
  if (/metro|train/.test(t)) SV.travel = "metro";
  if (/cheap|cheapest|budget/.test(t) && SV.travel === "drive") { SV.parkPref = "cheap"; SV.parkInPlan = true; }
  if (/less walking/.test(t)) seed = 1;
  setSurvey(SV);
  const plan = quickPlan(true);
  setPlan(plan);
  // chat-only Guide: the first plan gets a friendlier intro than "Updated."
  const done = fresh ? "Here's a plan for your day. Tell me what to change: less walking, a different lunch, more shops…" : "Updated.";
  return { role: "assistant", text: (changed.length ? "Got it: " + changed.join(", ") + ". " : "") + done, plan };
}

/* ---------------- AI planner via the host's sampling, when available ---------------- */
let sample: ClaudeSample | null | undefined;
let sampleTried: Promise<void> | null = null;
const loadSample = () => (sampleTried ??= getHost<ClaudeSample>("sample").then((s) => { sample = s; }));

function buildPrompt(): string {
  const { survey: SV, avoid, plan: curPlan } = getState();
  const day = planDay(SV);
  const dir = PLACES.filter(usable)
    .map((p) => {
      const w = p.wait || {};
      return `${p.id} | ${p.name} | ${p.type || p.cat} | ${p.legacy ? "LEGACY" : "-"} | ${p.hours ? hoursText(p.hours[DAYS[day]]) : "hours unknown"} | ${w.typical_wait_max ? "wait " + w.typical_wait_min + "-" + w.typical_wait_max + "min" : w.popular ? "popular" : "-"} | ${Math.round(p.x)},${Math.round(p.y)} | ${(p.desc || "").slice(0, 110)}`;
    })
    .join("\n");
  const lots = PLACES.filter((q) => q.cat === "park" && q.status !== "unknown")
    .map((q) => `${q.id} | ${q.name} | ${q.ratesShort || q.rates || "rates unknown"} | ${Math.round(q.x)},${Math.round(q.y)}`)
    .join("\n");
  return `You are the friendly trip planner on a Little Tokyo (Los Angeles) visitor website. Build and edit walking itineraries using ONLY places in the directory (by id) and parking from the parking list. Never invent places, hours, prices, menu items or wait times. Coordinates are metres; keep walks short. Respect hours on the visit day.
Survey answers: date ${SV.date || "today"}, start ${fmtT(toM(SV.start || "11:00"))}, length ${SV.dur}, interests ${SV.groups.map((g) => g + ": " + (SV.picks[g] || []).join("/")).join("; ")}, legacy ${SV.legacy}, travel ${SV.travel}${SV.travel === "drive" ? ", parking " + SV.parkPref + (SV.parkInPlan ? ", start and end at the parking" : "") : ""}. Never include: ${avoid.map((id) => (BY[id] || { name: "" }).name).join(", ") || "nothing"}.
If the visitor describes their day in their own words, those words override the survey.${iterationHas(getState().iteration, "chatGuide") ? " This is a chat with no survey. Match the size of the answer to the ask: if they want one place or a few ideas (\"where should I get ramen\", \"a couple of cafés\"), return plan null and \"picks\": 1-3 directory ids of exactly that kind, open now and close by. Only build a timed plan when they describe a visit or ask for a plan, and keep it realistic: at most one meal per 3 hours, with cafés, sights or shops between. If you don't know enough yet, ask one short question and return plan null; otherwise assume today from 11 AM." : ""} When they give feedback, change the plan and say in one sentence what changed. Put needs you can't confirm (diet, accessibility) in "tip".
Directory (id | name | type | legacy | hours that day | reported wait | position | description):
${dir}
Parking (id | name | rates | position):
${lots}
${curPlan ? "Current plan: " + JSON.stringify({ park: curPlan.park, stops: curPlan.stops.map((s) => ({ id: s.id, time: s.time })) }) : ""}
Reply with only JSON: {"reply":"1-2 friendly sentences","picks":["optional place ids, for suggestions"],"plan":{"title":"...","park":"parking id or null","stops":[{"id":"fugetsudo","time":"11:10 AM","minutes":20,"why":"one sentence"}],"tip":"optional"} or null if nothing changed}`;
}

let aiCtl: AbortController | null = null;
/** Answer a chat message (the chat must already include it): AI when available, else the offline keyword planner. */
export async function replyTo(text: string): Promise<ChatMsg> {
  await loadSample();
  try {
    if (!sample) return offlineReply(text);
    aiCtl = new AbortController();
    const turns = [{ role: "user", content: buildPrompt() }];
    getState().chat.slice(-12).forEach((m) => turns.push({ role: m.role, content: m.role === "user" ? m.text : JSON.stringify({ reply: m.text }) }));
    const out = await sample.json(turns, { signal: aiCtl.signal, cache: false });
    let plan: Plan | null = out && out.plan && Array.isArray(out.plan.stops) ? out.plan : null;
    if (plan) {
      plan.stops = plan.stops.filter((s) => s && BY[s.id] && usable(BY[s.id]));
      if (plan.park && !(BY[plan.park] && BY[plan.park].cat === "park")) plan.park = null;
      plan.date = getState().survey.date;
      if (!plan.stops.length) plan = null;
    }
    if (plan) setPlan(plan);
    const picks: string[] | null = out && Array.isArray(out.picks) ? out.picks.filter((id: unknown) => typeof id === "string" && BY[id]).slice(0, 5) : null;
    return { role: "assistant", text: String((out && out.reply) || (picks?.length ? "Here are some ideas." : "Updated your plan.")), plan, picks: picks?.length ? picks : null };
  } catch (e) {
    const c = (e as { code?: string })?.code;
    if (c && ["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(c)) sample = null;
    return offlineReply(text);
  }
}
