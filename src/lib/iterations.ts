/** Design iterations of the prototype. The config panel (desktop only) picks one.
 *  `diff` is the 1-2 line "what's different" shown under the dropdown. `features` are switches the
 *  app reads with iterationHas(); each iteration builds on the ones before it. Add new ones at the end. */
export type Feature =
  | "satellite" // photo imagery under the map
  | "eventsSheet" // events live in a bottom sheet on the map (no Events tab); details overlay it
  | "mapChips" // Parking / Restrooms lead the chip row; the round map buttons are gone
  | "noAccount"; // no account, saving, owner tools or light/dark toggle (always light)

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
    diff: "Events move into a bottom sheet on the map and place details slide over it. Parking and Restrooms become chips, the round map buttons go, and dark mode and accounts are removed.",
    features: ["satellite", "eventsSheet", "mapChips", "noAccount"],
  },
];

export const DEFAULT_ITERATION = "4";

export const iterationHas = (id: string, f: Feature) => (ITERATIONS.find((i) => i.id === id) ?? ITERATIONS[ITERATIONS.length - 1]).features.includes(f);
