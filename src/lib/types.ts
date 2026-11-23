export type Cat = "eat" | "shop" | "explore" | "park" | "wc" | "metro";
export type Status = "open" | "closed_permanently" | "moved" | "temp_closed" | "unknown";
export type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export type Hours = Partial<Record<DayKey, string>>;

export interface Photo {
  img?: string;
  /** a Wikimedia Commons thumbnail URL, for photos not stored in public/images */
  url?: string;
  src?: string;
  author?: string;
  license?: string;
  source?: string;
  subject?: string;
  caption?: string;
  venue?: boolean;
}

export interface RateRow {
  label: string;
  price: string;
}

export interface Wait {
  n?: number | string;
  name?: string;
  popular?: boolean;
  typical_wait_min?: number | null;
  typical_wait_max?: number | null;
  over?: boolean;
  peak?: string;
  offpeak_tip?: string;
  reservations?: string;
  basis?: string;
  sources?: string[];
  confidence?: "good" | "some" | "few" | string;
}

export interface Place {
  n: number | string;
  id: string;
  name: string;
  cat: Cat;
  x: number;
  y: number;
  posSrc?: string;
  tags: string[];
  status: Status;
  statusNote?: string | null;
  type?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  hours?: Hours | null;
  hoursNote?: string | null;
  hoursSource?: string | null;
  price?: string | null;
  admission?: string | null;
  desc?: string | null;
  knownFor?: string[];
  since?: number | null;
  legacy?: boolean;
  story?: string | null;
  storySource?: string | null;
  parking?: string | null;
  parkingNote?: string | null;
  restroom?: string | boolean | null;
  sources: string[];
  photos: Photo[];
  wait?: Wait | null;
  // parking
  rates?: string | null;
  rateList?: RateRow[] | null;
  ratesShort?: string | null;
  rateSrc?: string | null;
  rateDate?: string | null;
  rateConf?: string | null;
  entrance?: string | null;
  kind?: string | null;
  validation?: string | null;
  hoursText?: string | null;
  // restrooms
  access?: string | null;
  confidence?: string | null;
  // derived
  glyph: string;
  /** finer kind (ramen, sushi, cafe, sweets, bar…); food glyphs collapse to dining/cafe, so match on this */
  glyphKind: string;
  sub: string | null;
}

export interface EventItem {
  title: string;
  category: string;
  start: string;
  end?: string | null;
  time?: string | null;
  venue?: string | null;
  address?: string | null;
  description?: string | null;
  price?: string | null;
  url?: string | null;
  date_status?: string | null;
  recurring?: string | null;
  photo?: Photo | null;
}

/** A point the router can use: a place, or the visitor's own spot. */
export interface Pt {
  id?: string;
  x: number;
  y: number;
}

export interface Me extends Pt {
  label: string;
}

export interface PlanStop {
  id: string;
  time: string;
  minutes?: number;
  why?: string;
}

export interface Plan {
  title?: string;
  stops: PlanStop[];
  park?: string | null;
  date?: string | null;
  tip?: string;
  savedAt?: number;
}

export interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  plan?: Plan | null;
  /** a few suggested places (ids), when the visitor asked for ideas rather than a whole day */
  picks?: string[] | null;
}
