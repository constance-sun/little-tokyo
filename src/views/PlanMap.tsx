import { useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { BY, CATS, GEO, catColor } from "@/lib/data";
import { Icon } from "@/lib/icons";
import { route } from "@/lib/route";
import type { Place, Plan, Pt } from "@/lib/types";
import { useApp, useFeature } from "@/state/store";
import MapView from "./map/MapView";
import { PlaceDetailPage } from "./PlaceDetailPage";

/* The chat Guide's map for a plan: a small static preview inside the plan card, which expands to a
   temporary full-page map (the real map UI, in embedded plan mode) with a ✕ at the top right. */

const ROAD_W: Record<string, number> = {
  primary: 14, primary_link: 9, secondary: 12, tertiary: 10, unclassified: 8, residential: 8, service: 5, pedestrian: 6, footway: 2, steps: 2,
};
const ASPECT = 2; // preview is twice as wide as tall
const pts = (p: [number, number][]) => p.map(([x, y]) => x + "," + y).join(" ");

/** The plan's stops (with parking at both ends) and its walking legs, as on the map. */
function usePlanGeometry(plan: Plan) {
  const me = useApp((s) => s.me);
  return useMemo(() => {
    const stops = plan.stops.map((s) => BY[s.id]).filter(Boolean);
    const park = plan.park ? BY[plan.park] || null : null;
    const seq: Pt[] = [...(park ? [park] : [me]), ...stops, ...(park ? [park] : [])];
    const legs = seq.slice(1).map((b, i) => route(seq[i], b)?.pts ?? []);
    return { stops, park, legs, start: park ? null : me };
  }, [plan, me]);
}

/** Preview colours: Google-Maps-like by default; the kiosk look's flat greys and black route in iteration 6. */
const GM = { ground: "#f1f3f4", edge: "#dadce0", green: "#cdebd3", bldg: "#e3e5e8", road: "#fff", foot: "#c4c8cc", route: "#1a73e8" };
const KIOSK = { ground: "#fff", edge: "rgb(0 0 0 / 0.08)", green: "#eef5ec", bldg: "#e2e2e2", road: "#f2f2f2", foot: "#e4e4e4", route: "#000" };

export function PlanPreview({ plan, onExpand }: { plan: Plan; onExpand: () => void }) {
  const { stops, park, legs, start } = usePlanGeometry(plan);
  const c = useFeature("kiosk") ? KIOSK : GM;
  // fit everything with some margin, at the preview's aspect ratio
  const all: [number, number][] = [...legs.flat(), ...stops.map((p) => [p.x, p.y] as [number, number]), ...(park ? [[park.x, park.y] as [number, number]] : [])];
  if (!all.length) return null;
  let x0 = Math.min(...all.map((q) => q[0])), x1 = Math.max(...all.map((q) => q[0]));
  let y0 = Math.min(...all.map((q) => q[1])), y1 = Math.max(...all.map((q) => q[1]));
  const pad = 40;
  x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  let w = x1 - x0, h = y1 - y0;
  if (w / h < ASPECT) { const nw = h * ASPECT; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / ASPECT; y0 -= (nh - h) / 2; h = nh; }
  const px = w / 330; // metres per CSS pixel at a typical card width
  const inView = (p: [number, number][]) => p.some(([x, y]) => x > x0 - 60 && x < x0 + w + 60 && y > y0 - 60 && y < y0 + h + 60);

  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label="Open the map of this plan"
      className="relative mt-3 block w-full overflow-hidden rounded-[18px] border text-left"
      style={{ aspectRatio: `${ASPECT} / 1`, background: c.ground, borderColor: c.edge }}
    >
      <svg viewBox={`${x0} ${y0} ${w} ${h}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
        {GEO.areas.filter((a) => a.k === "green" && inView(a.p)).map((a, i) => <polygon key={"g" + i} points={pts(a.p)} fill={c.green} />)}
        {GEO.buildings.filter((b) => inView(b.p)).map((b, i) => <polygon key={"b" + i} points={pts(b.p)} fill={c.bldg} />)}
        {GEO.roads.filter((r) => inView(r.p)).map((r, i) => (
          <polyline
            key={"r" + i}
            points={pts(r.p)}
            fill="none"
            stroke={r.c === "footway" || r.c === "steps" ? c.foot : c.road}
            strokeWidth={ROAD_W[r.c] ?? 6}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={r.c === "footway" || r.c === "steps" ? "3 3" : undefined}
          />
        ))}
        {legs.map((l, i) => l.length > 1 && (
          <g key={"l" + i}>
            <polyline points={pts(l)} fill="none" stroke="#fff" strokeWidth={7 * px} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={pts(l)} fill="none" stroke={c.route} strokeWidth={4 * px} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
        {start && <circle cx={start.x} cy={start.y} r={5 * px} fill="var(--accent)" stroke="#fff" strokeWidth={2 * px} />}
        {park && <circle cx={park.x} cy={park.y} r={8 * px} fill={CATS.park.color} stroke="#fff" strokeWidth={2 * px} />}
        {stops.map((p) => <circle key={p.id} cx={p.x} cy={p.y} r={8 * px} fill={catColor(p)} stroke="#fff" strokeWidth={2 * px} />)}
      </svg>
      <span className="bg-surface/95 text-foreground absolute right-2.5 bottom-2.5 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold shadow-[var(--surface-shadow)]">
        <Icon name="expand" size={14} /> Open map
      </span>
    </button>
  );
}

/** Temporary full-page map of a plan: the whole map UI with the plan sheet, and a ✕ to go back to the chat. */
export function PlanMapPage({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const [detail, setDetail] = useState<Place | null>(null);
  return (
    <div role="dialog" aria-modal="true" aria-label={plan.title || "Your day on the map"} className="bg-background absolute inset-0 z-30 overflow-hidden">
      <MapView active plan={plan} onClose={onClose} onDetails={setDetail} />
      <Button
        isIconOnly
        variant="secondary"
        aria-label="Close map"
        onPress={onClose}
        className="bg-surface text-foreground absolute top-[calc(0.625rem+var(--bar,0px))] right-2.5 z-[25] size-10 rounded-full shadow-[var(--overlay-shadow)]"
      >
        <Icon name="close" size={18} />
      </Button>
      {detail && <PlaceDetailPage place={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
