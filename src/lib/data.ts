import GEO_JSON from "@/data/geo.json";
import POS_JSON from "@/data/positions.json";
import R_JSON from "@/data/research.json";
import PHOTOS_JSON from "@/data/photos.json";
import EVENTS_JSON from "@/data/events.json";
import LOGI_JSON from "@/data/logistics.json";
import WAITS_JSON from "@/data/waits.json";
import IMGS_JSON from "@/data/images.json";
import type { Cat, EventItem, Photo, Place, Wait } from "./types";

/* ======================================================================
   Raw data (extracted from the original single-file site).
   Map geometry: © OpenStreetMap contributors (ODbL). Positions in metres, x east / y south.
   ====================================================================== */
export const SITE_URL = "https://little-tokyo-six.vercel.app/";

export interface Geo {
  bounds: [number, number, number, number];
  buildings: { p: [number, number][]; n?: string; pk?: boolean }[];
  roads: { c: string; n?: string; p: [number, number][] }[];
  areas: { k: string; p: [number, number][] }[];
  graph: { n: [number, number][]; e: [number, number, number][]; names: string[] };
}
export const GEO = GEO_JSON as unknown as Geo;
export const IMGS = IMGS_JSON as Record<string, string>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = R_JSON as Record<string, any>;
const POS = POS_JSON as Record<string, { x: number; y: number; src?: string }>;
const PHOTOS = PHOTOS_JSON as unknown as Record<string, Photo[]>;
const WAITS = WAITS_JSON as unknown as Record<string, Wait>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LOGI = LOGI_JSON as any;

// photos are either extracted files (`img` key → /images/…) or Wikimedia Commons thumbnails linked directly (`url`)
for (const k in PHOTOS) PHOTOS[k].forEach((x) => { x.src = x.img ? IMGS[x.img] : x.url; });
export const EVENTS = EVENTS_JSON as unknown as EventItem[];
EVENTS.forEach((e) => { if (e.photo && e.photo.img) e.photo.src = IMGS[e.photo.img]; });
export const METRO_DESC: string | undefined = R.metro?.description;

/* ======================================================================
   Categories
   ====================================================================== */
export const CATS: Record<Cat, { label: string; color: string }> = {
  eat: { label: "Eat", color: "var(--c-eat)" },
  shop: { label: "Shop", color: "var(--c-shop)" },
  explore: { label: "Explore", color: "var(--c-explore)" },
  park: { label: "Parking", color: "var(--c-park)" },
  wc: { label: "Restroom", color: "var(--c-wc)" },
  metro: { label: "Metro", color: "var(--c-metro)" },
};

function glyphFor(p: { cat: Cat; type?: string | null; tags: string[]; name: string; id: string }) {
  const t = ((p.type || "") + " " + p.tags.join(" ") + " " + p.name).toLowerCase();
  if (p.cat === "park") return "park";
  if (p.cat === "wc") return "wc";
  if (p.cat === "metro") return "metro";
  if (p.cat === "eat") {
    if (/ramen|udon|noodle/.test(t)) return "ramen";
    if (/sushi/.test(t)) return "sushi";
    if (/mochi|confection|ice cream|yogurt|donut|dessert|sweets|imagawayaki/.test(t)) return "sweets";
    if (/cafe|coffee|tea|matcha/.test(t)) return "cafe";
    if (/bar\b|drinks|pub/.test(t)) return "bar";
    return "dining";
  }
  if (p.cat === "shop") {
    if (/book/.test(t)) return "books";
    if (/art|gallery|ceramic|craft|florist/.test(t)) return "art";
    return "shop";
  }
  if (p.id === "jvp") return "lantern";
  if (/church|catholic|methodist/.test(t)) return "church";
  if (/temple|buddhist|betsuin|mission|hongwanji|honganji/.test(t)) return "temple";
  if (/museum|go for broke/.test(t)) return "museum";
  if (/theater|theatre|arts|cultural/.test(t)) return "theater";
  if (/lounge|music/.test(t)) return "music";
  if (/library/.test(t)) return "books";
  return "people";
}

/* n = number on the official visitor map; tags drive the day planner */
const BASE: [number | string, string, string, Cat, string][] = [
  [1,"animejungle","Anime Jungle","shop","anime gifts"],[2,"anzen","Anzen Hardware","shop","gifts history"],[3,"bloomingart","Blooming Art Gallery","shop","art"],
  [4,"bunkado","Bunkado","shop","gifts history"],[5,"crft","CRFT by Maki","shop","art gifts"],[6,"hobnob","Hob Nob","shop","gifts"],[7,"japangeles","Japangeles","shop","gifts"],
  [8,"ginza","Ginza USA","shop","gifts"],[9,"ltflorist","Little Tokyo Florist","shop","gifts art"],[10,"kinokuniya","Kinokuniya Book Store","shop","books anime"],
  [11,"makeasobi","Make Asobi","shop","art gifts"],[12,"popkiller","Popkiller","shop","gifts anime"],[13,"rafubussan","Rafu Bussan","shop","gifts art history"],
  [14,"rifla","RIF LA","shop","gifts"],[15,"utsuwa","Utsuwa-No-Yakata","shop","art gifts"],[16,"ashiya","Shop Ashiya","shop","gifts"],[17,"tokyooutlet","Tokyo Japanese Outlet","shop","gifts"],
  [18,"casaheiwa","Casa Heiwa / Little Tokyo Service Center","explore","history"],[19,"centenary","Centenary United Methodist Church","explore","history"],
  [20,"fareastlounge","Far East Lounge","explore","music history"],[21,"goforbroke","Go For Broke National Education Center","explore","history"],
  [22,"higashi","Higashi Honganji Buddhist Temple","explore","history"],[23,"jaccc","Japanese American Cultural & Community Center","explore","history art"],
  [24,"janm","Japanese American National Museum","explore","history art"],[25,"jodoshu","Jodoshu Buddhist Temple","explore","history"],
  [26,"koyasan","Koyasan Buddhist Temple","explore","history"],[27,"library","Little Tokyo Library","explore","books"],[28,"ltowers","Little Tokyo Towers","explore","history"],
  [29,"stfrancis","St. Francis Xavier Japanese Catholic Center","explore","history"],[30,"nishi","Nishi Hongwanji Los Angeles Betsuin","explore","history"],
  [31,"tenterraces","Ten Terraces Parking Garage","park",""],[32,"unioncenter","Union Center for the Arts","explore","art music"],
  [33,"unionchurch","Union Church of Los Angeles","explore","history"],[34,"wakaba","Wakaba Parking Garage","park",""],[35,"zenshuji","Zenshuji Soto Mission","explore","history"],
  [36,"alohacafe","Aloha Cafe","eat","comfort"],[37,"azay","Azay","eat","comfort"],[38,"cafedulce","Cafe Dulce","eat","sweets coffee"],[39,"donatsu","Donatsu","eat","sweets"],
  [40,"rakkan","Rakkan Ramen","eat","ramen"],[41,"farbar","Far Bar","eat","drinks history"],[42,"fugetsudo","Fugetsu-Do","eat","sweets history"],[43,"jist","JiST Cafe","eat","coffee comfort"],
  [44,"hanaichimonme","Hana Ichimonme","eat","ramen"],[45,"koreabbq","Korea BBQ House","eat","comfort"],[46,"kouraku","Kouraku","eat","ramen comfort"],[47,"lasgalas","Las Galas","eat","comfort"],
  [48,"ltice","Little Tokyo Ice Cream & Yogurt","eat","sweets"],[49,"sushitakeda","Sushi Takeda","eat","sushi"],[50,"mitsurucafe","Mitsuru Cafe","eat","sweets history"],
  [51,"mitsurusushi","Mitsuru Sushi & Grill","eat","sushi"],[52,"mrramen","Mr. Ramen","eat","ramen"],[53,"oomasa","Oomasa","eat","sushi history"],[54,"orochon","Orochon Ramen","eat","ramen"],
  [55,"ricenori","Rice & Nori","eat","comfort"],[56,"shabushabu","Shabu Shabu House","eat","comfort"],[57,"pastaepasta","Pasta e Pasta by Allegro","eat","comfort"],
  [58,"sushiteri","Sushi & Teri","eat","sushi"],[59,"sushikomasa","Sushi Komasa","eat","sushi"],[60,"sushigen","Sushi Gen","eat","sushi"],[61,"tamon","Tamon Sushi","eat","sushi"],
  [62,"tanota","TaNoTa Takoyaki","eat","snacks"],[63,"teamaster","Tea Master","eat","sweets coffee"],[64,"tot","Teishokuya of Tokyo (T.O.T.)","eat","comfort"],
  [65,"keepers","Keepers","eat","coffee"],[66,"zencu","Zencu Sushi & Grill","eat","sushi"],
  ["d1","daikokuya","Daikokuya","eat","ramen"],["d2","monzo","Marugame Monzo","eat","ramen"],
  ["jvp","jvp","Japanese Village Plaza","explore","gifts history snacks"],["metro","metro","Little Tokyo/Arts District Station","metro",""],
];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EXTRA: Record<string, any> = { // two famous spots that are not numbered on the official map
  daikokuya: { type: "Ramen shop", address: "327 E 1st St, Los Angeles, CA 90012", status: "open", legacy: true, description: "Long-running tonkotsu ramen counter on historic 1st Street, known for rich pork broth and a line out the door at dinner.", sources: ["https://littletokyohs.org/legacy-businesses"] },
  monzo: { type: "Udon restaurant", address: "329 E 1st St, Los Angeles, CA 90012", status: "open", description: "Udon shop where the noodles are made by hand in a glass room by the entrance.", sources: [] },
};

/* ======================================================================
   Merge base list + research + logistics into PLACES
   ====================================================================== */
type Raw = Omit<Place, "glyph" | "glyphKind" | "sub"> & { glyph?: string; sub?: string | null };
const raw: Raw[] = [];
for (const [n, id, name, cat, tags] of BASE) {
  const r = R[String(n)] || EXTRA[id] || {};
  const pos = POS[id] || { x: 0, y: 0 };
  const w = WAITS[id] && WAITS[id].typical_wait_max != null ? WAITS[id] : null;
  raw.push({
    n, id, name: r.name && r.name.length < 48 ? r.name : name, cat, x: pos.x, y: pos.y, posSrc: pos.src,
    tags: tags ? tags.split(" ") : [], status: r.status || "unknown", statusNote: r.status_note || null, type: r.type || null,
    address: r.address || null, phone: r.phone || null, website: r.website || null, hours: r.hours || null,
    hoursNote: r.hours_note || null, hoursSource: r.hours_source || null, price: r.price || null, admission: r.admission || null,
    desc: r.description || null, knownFor: r.known_for || [], since: r.since || null, legacy: !!r.legacy,
    story: r.owner_story || r.history || null, storySource: r.owner_story_source || null, parking: r.parking || null,
    parkingNote: r.parking_note || null, restroom: r.restroom || r.restroom_for_customers || null, sources: r.sources || [],
    photos: PHOTOS[id] || [], wait: w || WAITS[String(n)] || WAITS[id] || null,
  });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parkFields = (g: any) => ({
  rates: g.rates_text || (typeof g.rates === "string" ? g.rates : null) || null, rateList: g.rateList || null, ratesShort: g.ratesShort || null,
  rateSrc: g.rateSrc || null, rateDate: g.rateDate || null, rateConf: g.rateConf || null, entrance: g.entrance || null,
  kind: g.kind || null, validation: g.validation || null, hoursText: g.hours || null,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(LOGI.parking || []).forEach((g: any, i: number) =>
  raw.push({ n: "g" + i, id: "park" + i, name: g.name, cat: "park", x: g.x, y: g.y, tags: [], status: "open", address: g.address,
    desc: g.serves ? "Serves " + g.serves + "." : null, ...parkFields(g), sources: g.source ? [g.source] : [], photos: [] }));
raw.filter((p) => p.cat === "park" && R[String(p.n)] && R[String(p.n)].park).forEach((p) => Object.assign(p, parkFields(R[String(p.n)].park)));
(LOGI.mapP || []).forEach(([x, y]: [number, number], i: number) => {
  if (raw.some((q) => q.cat === "park" && Math.hypot(q.x - x, q.y - y) < 30)) return;
  raw.push({ n: "p" + i, id: "mapp" + i, name: "Public parking", cat: "park", x, y, tags: [], status: "unknown",
    desc: "Parking shown on the official Little Tokyo visitor map. Rates and hours not confirmed.", sources: [], photos: [] });
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(LOGI.restrooms || []).forEach((w: any, i: number) =>
  raw.push({ n: "w" + i, id: "wc" + i, name: w.name, cat: "wc", x: w.x, y: w.y, tags: [], status: "open", address: w.address,
    access: w.access, hoursText: w.hours, confidence: w.confidence, desc: w.note || null, sources: w.source ? [w.source] : [], photos: [] }));

/* Sub-types shown in the map's Filter panel, per category: [key, label, icon] */
export const SUBS: Partial<Record<Cat, [string, string, string][]>> = {
  eat: [["ramen","Ramen & noodles","ramen"],["sushi","Sushi","sushi"],["comfort","Comfort food & bento","dining"],["bbq","Korean BBQ","dining"],["cafes","Cafés & sweets","cafe"],["snacks","Snacks & street food","sweets"],["bars","Bars","bar"],["intl","International","dining"]],
  shop: [["gifts","Gifts & souvenirs","shop"],["anime","Anime & pop culture","star"],["fashion","Fashion & sneakers","shop"],["books","Books","books"],["home","Ceramics & home","art"],["artcraft","Art, crafts & flowers","art"]],
  explore: [["temples","Temples","temple"],["churches","Churches","church"],["museums","Museums","museum"],["arts","Theater & music","theater"],["community","Community & plazas","lantern"]],
};
const TYPE_OF: Record<string, string> = {
  tot:"comfort",azay:"comfort",ricenori:"comfort",shabushabu:"comfort",koreabbq:"bbq",tanota:"snacks",ltice:"cafes",pastaepasta:"intl",alohacafe:"intl",farbar:"bars",lasgalas:"sushi",jist:"cafes",keepers:"cafes",
  animejungle:"anime",popkiller:"fashion",japangeles:"fashion",rifla:"fashion",hobnob:"fashion",kinokuniya:"books",utsuwa:"home",anzen:"home",bloomingart:"artcraft",crft:"artcraft",makeasobi:"artcraft",ltflorist:"artcraft",
  centenary:"churches",stfrancis:"churches",unionchurch:"churches",janm:"museums",goforbroke:"museums",unioncenter:"arts",jaccc:"arts",fareastlounge:"arts",library:"community",casaheiwa:"community",ltowers:"community",jvp:"community",
};
function subOf(p: Raw & { glyph: string }) {
  if (TYPE_OF[p.id]) return TYPE_OF[p.id];
  const g = p.glyph;
  if (p.cat === "eat") return g === "ramen" ? "ramen" : g === "sushi" ? "sushi" : g === "cafe" || g === "sweets" ? "cafes" : g === "bar" ? "bars" : "comfort";
  if (p.cat === "shop") return g === "books" ? "books" : g === "art" ? "artcraft" : "gifts";
  if (p.cat === "explore") return g === "temple" ? "temples" : g === "church" ? "churches" : g === "museum" ? "museums" : g === "theater" || g === "music" ? "arts" : "community";
  return null;
}

/** The pin icon. Food places all share the fork and spoon, except coffee/matcha cafés (coffee cup);
 *  the finer kind (ramen, sushi, bar…) still decides the Filter panel's sub-type. */
const pinGlyph = (r: Raw, kind: string) =>
  r.cat !== "eat" ? kind : r.tags.includes("coffee") || /coffee|matcha|espresso/i.test(r.type || "") ? "cafe" : "dining";

export const PLACES: Place[] = raw.map((r) => {
  const kind = glyphFor(r);
  return { ...r, glyph: pinGlyph(r, kind), glyphKind: kind, sub: subOf({ ...r, glyph: kind }) } as Place;
});
export const BY: Record<string, Place> = Object.fromEntries(PLACES.map((p) => [p.id, p]));
export const LEGACY = PLACES.filter((p) => p.legacy);
export const WCS = PLACES.filter((p) => p.cat === "wc");
export const PARKING = PLACES.filter((p) => p.cat === "park");
export const POI = (p: Place) => p.cat === "eat" || p.cat === "shop" || p.cat === "explore";
export const isGone = (p: Place) => p.status === "closed_permanently" || p.status === "moved";
export const isClosedish = (p: Place) => p.status === "closed_permanently" || p.status === "moved" || p.status === "temp_closed";

/* ======================================================================
   Events
   ====================================================================== */
export const ECAT: Record<string, [label: string, icon: string, color: string]> = {
  festival: ["Festival", "lantern", "#e0301e"], popup: ["Pop-up", "shop", "#ff4f6d"], music: ["Music", "music", "#9b6bff"],
  theater: ["Theater", "theater", "#2f8fe0"], art: ["Art & film", "art", "#13a08c"], community: ["Community", "people", "#e2a23a"],
  food: ["Food", "dining", "#f39a2e"], exhibit: ["Exhibit", "museum", "#5b7cff"],
};

/** The place on the map an event happens at, if we know it. */
export function eventVenue(e: EventItem): Place | undefined {
  const v = e.venue;
  if (!v) return undefined;
  return PLACES.find(
    (p) =>
      (p.id === "janm" && /janm|national museum/i.test(v)) ||
      (p.id === "jaccc" && /jaccc|aratani|cultural/i.test(v)) ||
      (p.id === "jvp" && /village plaza/i.test(v)) ||
      (p.id === "unioncenter" && /union center|east west players|david henry hwang/i.test(v)) ||
      (p.id === "goforbroke" && /go for broke/i.test(v)) ||
      v.toLowerCase().includes(p.name.toLowerCase()),
  );
}
