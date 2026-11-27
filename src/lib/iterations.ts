/** Design iterations of the prototype. The config panel (desktop only) picks one.
 *  `diff` is the 1-2 line "what's different" shown under the dropdown. `features` are switches the
 *  app reads with iterationHas(); each iteration builds on the ones before it. Add new ones at the end. */
export type Feature =
  | "satellite" // photo imagery under the map
  | "eventsSheet" // events live in a bottom sheet on the map (no Events tab); details overlay it
  | "mapChips" // Parking / Restrooms lead the chip row; the round map buttons are gone
  | "noAccount" // no account, saving, owner tools or light/dark toggle (always light)
  | "menuPage" // header is the emblem + a Menu button that opens a full-page menu (no tab row)
  | "gmaps" // drawn Google-Maps-style base map; only Little Tokyo's own buildings are coloured
  | "chatGuide" // the Guide (Plan a day) page is one full-page AI chat: no survey or hold-to-talk
  | "kiosk"; // the Little Tokyo Directory kiosk's look: black ink, bright category pills, a flat grey map, a sky wash

export interface Iteration {
  id: string;
  name: string;
  diff: string;
  features: Feature[];
}

export const ITERATIONS: Iteration[] = [
  {
    id: "1",
    name: "1 · Paper poster",
    diff: "The original single-file look: crisp white paper, near-black ink, square corners, hairline rules and a paper-grain overlay.",
    features: [],
  },
  {
    id: "2",
    name: "2 · HeroUI redesign",
    diff: "HeroUI v3's soft look: grey background with rounded white cards, pill chips and buttons, segmented tabs, and the Little Tokyo red as accent.",
    features: [],
  },
  {
    id: "3",
    name: "3 · Satellite map",
    diff: "The map shows photo-real satellite imagery instead of drawn streets and buildings, with white street names and tinted buildings for filters.",
    features: ["satellite"],
  },
  {
    id: "4",
    name: "4 · Google Maps style",
    diff: "Events move into a bottom sheet on the map and place details slide over it. A Menu button replaces the tabs, Parking and Restrooms become chips, and dark mode and accounts are removed.",
    features: ["satellite", "eventsSheet", "mapChips", "noAccount", "menuPage"],
  },
  {
    id: "5",
    name: "5 · Drawn map",
    diff: "Back to a drawn map in Google Maps colours: grey ground, white streets, green parks. Only Little Tokyo's own buildings are coloured, by what's inside. Events go back to their own page, listed in the menu. The Guide is just a chat: describe your day and the plan is built in the conversation.",
    features: ["gmaps", "mapChips", "noAccount", "menuPage", "chatGuide"],
  },
  {
    id: "6",
    name: "6 · Kiosk style",
    diff: "The look of the Little Tokyo Directory kiosk: black ink instead of red, bright pink / yellow / cyan / blue category pills, a black pill search bar, a calm grey map with teardrop pins and a black route, and a faint sky-to-white wash from the top of the screen.",
    features: ["gmaps", "mapChips", "noAccount", "menuPage", "chatGuide", "kiosk"],
  },
];

export const DEFAULT_ITERATION = "5";

export const iterationHas = (id: string, f: Feature) => (ITERATIONS.find((i) => i.id === id) ?? ITERATIONS[ITERATIONS.length - 1]).features.includes(f);
