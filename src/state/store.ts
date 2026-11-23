import { useSyncExternalStore } from "react";
import { toast as heroToast } from "@heroui/react";
import { BY } from "@/lib/data";
import { DEFAULT_ITERATION, iterationHas, type Feature } from "@/lib/iterations";
import { store } from "@/lib/storage";
import { clearWalkCache } from "@/lib/route";
import type { ChatMsg, Me, Plan } from "@/lib/types";
import type { ClaudeDB } from "@/lib/claude";

/* ======================================================================
   One small global store (useSyncExternalStore). Views read slices with useApp(sel)
   and call the actions below. localStorage keys match the original site so saved
   data carries over.
   ====================================================================== */

export type View = "home" | "map" | "events" | "plan" | "legacy" | "account";
export const VIEWS: View[] = ["home", "map", "events", "plan", "legacy", "account"];
export type ThemeMode = "auto" | "light" | "dark";

export interface Survey {
  date: string | null;
  start: string;
  dur: "short" | "half" | "full";
  groups: string[];
  picks: Record<string, string[]>;
  travel: "drive" | "metro" | "walk" | "skip";
  parkPref: "cheap" | "close";
  parkInPlan: boolean;
  legacy: boolean;
  step: number;
}
export const S0: Survey = {
  date: null, start: "11:00", dur: "half", groups: ["food", "shop"],
  picks: { food: ["ramen", "cafes"], shop: ["gifts"], explore: ["temples"] },
  travel: "metro", parkPref: "cheap", parkInPlan: true, legacy: true, step: 0,
};

export interface Account {
  type: "visitor" | "business" | null;
  business: string | null;
  plans: Plan[];
  saved: string[];
  prefs: unknown;
  newsletter: { email: string; at: number; interests?: string[] } | null;
}

/** A command for the map view, issued from other views ("show this place", "show this plan"). */
export type MapCmd =
  | { kind: "open"; id: string; n: number }
  | { kind: "plan"; plan: Plan; n: number }
  | { kind: "dir"; id: string; n: number } // walking directions to a place
  | { kind: "near"; id: string; near: "park" | "wc"; n: number }; // route to the nearest parking/restroom

export interface LiveWait { minutes: number; at: number }

export interface AppState {
  view: View;
  themeMode: ThemeMode;
  dark: boolean;
  me: Me;
  saved: string[];
  acct: Account;
  acctMode: "device" | "cloud";
  meInfo: { id?: string; name?: string; email?: string } | null;
  live: Record<string, LiveWait>;
  db: ClaudeDB | null;
  canPost: boolean | null;
  mapCmd: MapCmd | null;
  survey: Survey;
  plan: Plan | null;
  chat: ChatMsg[];
  avoid: string[];
  iteration: string;
  /** Minimum room between full map pins, in screen px (Config panel slider); crowded pins shrink to points. */
  pinSpace: number;
}

export const PIN_SPACE_DEFAULT = 45;
// the Config panel exists only in dev builds, so production always uses the defaults
// (a visitor who once picked another iteration or pin spacing isn't stuck on it with no panel)
const CONFIG = import.meta.env.DEV;
const savedSpace = CONFIG ? store.get<unknown>("lt-pin-space", PIN_SPACE_DEFAULT) : PIN_SPACE_DEFAULT;

const metro = BY.metro;
const systemDark = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;
const themeMode = store.get<ThemeMode>("lt-theme", "auto");
const localAcct = store.get<Partial<Account> | null>("lt-acct", null);

let state: AppState = {
  view: "home", // the site always opens on the cover page
  themeMode,
  dark: themeMode === "dark" || (themeMode === "auto" && systemDark()),
  me: store.get<Me | null>("lt-me3", null) || { x: metro.x, y: metro.y, label: "Metro station" },
  saved: store.get<string[]>("lt-saved", []),
  acct: { type: null, business: null, plans: [], saved: [], prefs: null, newsletter: null, ...(localAcct || {}) },
  acctMode: "device",
  meInfo: null,
  live: {},
  db: null,
  canPost: null,
  mapCmd: null,
  survey: { ...S0, ...store.get<Partial<Survey>>("lt-survey", {}) },
  plan: store.get<Plan | null>("lt-plan", null),
  chat: store.get<ChatMsg[]>("lt-chat", []),
  avoid: store.get<string[]>("lt-avoid", []),
  iteration: CONFIG ? store.get<string>("lt-iteration", DEFAULT_ITERATION) : DEFAULT_ITERATION,
  pinSpace: typeof savedSpace === "number" ? savedSpace : PIN_SPACE_DEFAULT,
};

const subs = new Set<() => void>();
export const getState = () => state;
export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
export function useApp<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state));
}
/** Is this feature on in the chosen design iteration? */
export const useFeature = (f: Feature) => useApp((s) => iterationHas(s.iteration, f));

/* ---------------- actions ---------------- */
/** Short status message (HeroUI toast, shown at the top of the phone screen). */
export function toast(msg: string) {
  heroToast(msg, { timeout: 2400 });
}

export function navigate(v: View) {
  if (location.hash.slice(1) !== v) location.hash = v;
  else setState({ view: v });
}

let cmdN = 0;
/** Switch to the map and open a place's sheet. */
export function openOnMap(id: string) {
  setState({ mapCmd: { kind: "open", id, n: ++cmdN } });
  navigate("map");
}
/** Switch to the map and show a day plan with its walking legs. */
export function showPlanOnMap(plan: Plan) {
  setState({ mapCmd: { kind: "plan", plan, n: ++cmdN } });
  navigate("map");
}
/** Switch to the map with walking directions to a place. */
export function directionsOnMap(id: string) {
  setState({ mapCmd: { kind: "dir", id, n: ++cmdN } });
  navigate("map");
}
/** Switch to the map with a route from a place to its nearest parking or restroom. */
export function nearestOnMap(id: string, near: "park" | "wc") {
  setState({ mapCmd: { kind: "near", id, near, n: ++cmdN } });
  navigate("map");
}
export const consumeMapCmd = () => setState({ mapCmd: null });

export function setMe(x: number, y: number) {
  const me = { x, y, label: "You are here" };
  store.set("lt-me3", me);
  clearWalkCache();
  setState({ me });
  toast("Start point set.");
}

export function setTheme(m: ThemeMode) {
  store.set("lt-theme", m);
  setState({ themeMode: m, dark: m === "dark" || (m === "auto" && systemDark()) });
}
if (typeof matchMedia !== "undefined")
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => setTheme(getState().themeMode));

export function setIteration(iteration: string) {
  store.set("lt-iteration", iteration);
  setState({ iteration });
}

export function setPinSpace(pinSpace: number) {
  store.set("lt-pin-space", pinSpace);
  setState({ pinSpace });
}

export function setSurvey(patch: Partial<Survey>) {
  const survey = { ...state.survey, ...patch };
  store.set("lt-survey", survey);
  setState({ survey });
}
export function resetSurvey() {
  store.set("lt-survey", S0);
  store.set("lt-avoid", []);
  setState({ survey: { ...S0 }, avoid: [] });
}
export function setPlan(plan: Plan | null) {
  store.set("lt-plan", plan);
  setState({ plan });
}
export function setChat(chat: ChatMsg[]) {
  store.set("lt-chat", chat.slice(-30));
  setState({ chat });
}
/** Chat Guide: start over (clears the conversation and its plan). */
export function newChat() {
  setChat([]);
  setPlan(null);
}
export function addAvoid(id: string) {
  const avoid = [...new Set([...state.avoid, id])];
  store.set("lt-avoid", avoid);
  setState({ avoid });
}

/* ---------------- account ---------------- */
const acctDoc = (k: string) => (state.db && state.meInfo?.id ? state.db.doc("data/users/" + state.meInfo.id + "/" + k) : null);
const pack = (a: Account, saved: string[]) => ({ type: a.type, business: a.business, plans: a.plans.slice(-12), saved, prefs: a.prefs, newsletter: a.newsletter });

export async function persistAccount(patch?: Partial<Account>, savedOverride?: string[]) {
  const acct = { ...state.acct, ...(patch || {}) };
  const saved = savedOverride ?? state.saved;
  acct.saved = saved;
  store.set("lt-acct", pack(acct, saved));
  store.set("lt-saved", saved);
  setState({ acct, saved });
  if (state.acctMode === "cloud") {
    try {
      await acctDoc("profile")?.set(pack(acct, saved));
    } catch {
      toast("Couldn't sync. Saved on this device.");
    }
  }
}

export function toggleSaved(id: string) {
  const has = state.saved.includes(id);
  if (!state.acct.type && !has) toast("Saved on this phone.");
  const saved = has ? state.saved.filter((x) => x !== id) : [...state.saved, id];
  void persistAccount(undefined, saved);
  toast(has ? "Removed from your list" : "Saved to your list");
}

export const planKey = (p: Plan) => JSON.stringify(p.stops);
export async function savePlan(plan: Plan) {
  if (!state.acct.type) {
    toast("Create a free account to save plans");
    navigate("account");
    return;
  }
  const plans = [...state.acct.plans.filter((x) => planKey(x) !== planKey(plan)), { ...plan, savedAt: Date.now() }];
  await persistAccount({ plans });
  toast("Plan saved to your account");
}

export function signOut() {
  const newsletter = state.acct.newsletter;
  store.set("lt-acct", null);
  store.set("lt-saved", []);
  if (state.acctMode === "cloud") acctDoc("profile")?.delete().catch(() => {});
  setState({ acct: { type: null, business: null, plans: [], saved: [], prefs: null, newsletter }, saved: [] });
  toast("Signed out and cleared");
}

export async function subscribeNewsletter(email: string) {
  const rec = { email, at: Date.now(), interests: state.survey.groups };
  try {
    if (state.acctMode === "cloud" && state.meInfo?.id) await state.db.doc("newsletter/" + state.meInfo.id).set(rec);
    await persistAccount({ newsletter: rec });
    toast(state.acctMode === "cloud" ? "Subscribed" : "You're on the list.");
  } catch {
    toast("Couldn't subscribe. Try again.");
  }
}
export async function unsubscribeNewsletter() {
  try {
    if (state.acctMode === "cloud" && state.meInfo?.id) await state.db.doc("newsletter/" + state.meInfo.id).delete();
    await persistAccount({ newsletter: null });
    toast("Unsubscribed");
  } catch {
    toast("Couldn't unsubscribe. Try again.");
  }
}

/* ---------------- live wait times (business owners) ---------------- */
export async function postWait(id: string, minutes: number | null) {
  const db = state.db;
  if (!db) {
    toast("Owner tools aren't live yet");
    return;
  }
  try {
    if (minutes == null) await db.doc("waits/" + id).delete();
    else await db.doc("waits/" + id).set({ minutes, at: Date.now() });
    toast(minutes == null ? "Wait time cleared" : "Wait time posted. Visitors see it now.");
  } catch (e) {
    const code = (e as { code?: string })?.code;
    toast(code === "not_granted" || code === "permission_denied" ? "Only business owners with edit access can post wait times" : "Couldn't post the wait time. Try again.");
  }
}
