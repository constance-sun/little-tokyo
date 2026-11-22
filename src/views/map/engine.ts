import { Imagery } from "./imagery";
import { CATS, GEO, PLACES, POI, isClosedish, isGone } from "@/lib/data";
import { isOpen } from "@/lib/hours";
import { ICONS } from "@/lib/icons";
import { fmtMin, prefersReducedMotion } from "@/lib/format";
import { waitVal } from "@/lib/waits";
import type { Route } from "@/lib/route";
import type { Me, Place } from "@/lib/types";
import type { LiveWait } from "@/state/store";

/* ======================================================================
   The map engine. Draws the real OpenStreetMap outlines into an SVG once, then
   moves a camera (cx, cy = world centre in metres; z = screen px per metre) and
   positions pins imperatively, so pan/zoom never re-renders React.
   Ported from the original single-file site.
   ====================================================================== */

const NS = "http://www.w3.org/2000/svg";
const sv = (t: string, a: Record<string, string | number> = {}, txt?: string) => {
  const n = document.createElementNS(NS, t);
  for (const [k, v] of Object.entries(a)) n.setAttribute(k, String(v));
  if (txt != null) n.textContent = txt;
  return n;
};
export const svgIcon = (name: string, size = 16, stroke = "#fff") =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" style="stroke:${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.star}</svg>`;

const [BX0, BY0, BX1, BY1] = GEO.bounds;
export const ZMAX = 7;
const pip = (x: number, y: number, poly: [number, number][]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

interface Bld {
  el: SVGPolygonElement;
  sh: SVGPolygonElement;
  pts: [number, number][];
  inside: Place[];
  gray: boolean;
  pk: boolean;
}

/** What decides which pins and buildings show. Owned by React, pushed in with update(). */
export interface MapFilterState {
  filter: string;
  subs: Set<string>;
  waitF: string;
  showWC: boolean;
  selected: Place | null;
  routeTarget: Place | null;
  planMode: boolean;
  live: Record<string, LiveWait>;
}

export interface PlanLeg { a: Place | Me; b: Place | Me; r: Route | null; start?: boolean }

export interface EngineCallbacks {
  onPinClick(p: Place): void;
  onMapTap(x: number, y: number): "picked" | void; // returns "picked" when pick-mode consumed it
  onEmptyTap(): void;
  sheetH(): number;
}

export function waitOK(p: Place, f: string, live: Record<string, LiveWait>) {
  if (f === "any") return true;
  const v = waitVal(p, live);
  return v != null && v <= Number(f);
}

export class MapEngine {
  svg: SVGSVGElement;
  world: SVGGElement;
  box: HTMLElement;
  pinsEl: HTMLElement;
  scaleBar: HTMLElement;
  scaleTxt: HTMLElement;
  cb: EngineCallbacks;

  cam = { cx: -20, cy: 20, z: 1.2 };
  W = 390;
  H = 600;
  anim = 0;
  lastNameZ = 0;
  moved = false;
  introDone = false;

  routeG!: SVGGElement;
  namesG!: SVGGElement;
  plbls: SVGTextElement[] = [];
  blds: Bld[] = [];
  lots: SVGPolygonElement[] = [];
  bldOf = new Map<string, Bld>();
  pinOf = new Map<string, HTMLButtonElement>();
  clusters: (HTMLButtonElement & { _x: number; _y: number })[] = [];
  marks: (HTMLElement & { _x: number; _y: number })[] = [];
  meEl: HTMLDivElement | null = null;
  me: Me | null = null;
  st: MapFilterState = { filter: "all", subs: new Set(), waitF: "any", showWC: false, selected: null, routeTarget: null, planMode: false, live: {} };
  labT = 0;
  imgT = 0;
  imagery!: Imagery;
  satellite = false;
  parkZoomed = false;
  private off: (() => void)[] = [];

  constructor(o: { svg: SVGSVGElement; world: SVGGElement; box: HTMLElement; pins: HTMLElement; scaleBar: HTMLElement; scaleTxt: HTMLElement; cb: EngineCallbacks }) {
    this.svg = o.svg;
    this.world = o.world;
    this.box = o.box;
    this.pinsEl = o.pins;
    this.scaleBar = o.scaleBar;
    this.scaleTxt = o.scaleTxt;
    this.cb = o.cb;
    this.draw();
    this.buildPins();
    this.gestures();
    this.measure();
    this.cam.z = this.zmin();
    this.cam.cx = (BX0 + BX1) / 2;
    this.cam.cy = (BY0 + BY1) / 2;
    this.render();
  }

  destroy() {
    cancelAnimationFrame(this.anim);
    clearTimeout(this.labT);
    clearTimeout(this.imgT);
    this.off.forEach((f) => f());
    this.world.replaceChildren();
    this.svg.querySelector("defs")?.remove();
    this.pinsEl.replaceChildren();
  }

  /* ---------------- drawing ---------------- */
  private draw() {
    const defs = sv("defs");
    const cp = sv("clipPath", { id: "lt-bounds" });
    cp.append(sv("rect", { x: BX0, y: BY0, width: BX1 - BX0, height: BY1 - BY0 }));
    defs.append(cp);
    this.svg.prepend(defs);
    const world = this.world;
    world.setAttribute("clip-path", "url(#lt-bounds)");
    world.append(sv("rect", { x: BX0, y: BY0, width: BX1 - BX0, height: BY1 - BY0, fill: "var(--ground)", class: "g-ground" }));
    this.imagery = new Imagery(world as SVGGElement, [BX0, BY0, BX1, BY1]);
    const ptsAttr = (p: [number, number][]) => p.map((q) => q.join(",")).join(" ");
    for (const a of GEO.areas) {
      if (a.p.length < 3) continue;
      const pg = sv("polygon", {
        points: ptsAttr(a.p),
        fill: a.k === "green" ? "var(--green)" : a.k === "parking" ? "var(--lot)" : "var(--plaza)",
        stroke: a.k === "parking" ? "var(--lot-edge)" : "none",
        "stroke-width": 1,
        class: a.k === "parking" ? "lotp" : "area",
      }) as SVGPolygonElement;
      world.append(pg);
      if (a.k === "parking") this.lots.push(pg);
    }
    // streets: casing then fill, minor first
    const WD: Record<string, number> = { primary: 20, secondary: 17, tertiary: 14, residential: 11, unclassified: 11, living_street: 9, primary_link: 12, secondary_link: 11, service: 6, pedestrian: 7, footway: 2.6, steps: 2.6 };
    const order = ["service", "footway", "steps", "pedestrian", "living_street", "residential", "unclassified", "tertiary", "secondary_link", "primary_link", "secondary", "primary"];
    const cas = sv("g", { class: "g-streets" }), fil = sv("g", { class: "g-streets" });
    const d = (p: [number, number][]) => "M" + p.map((q) => q.join(" ")).join("L");
    for (const cls of order)
      for (const r of GEO.roads) {
        if (r.c !== cls) continue;
        const w = WD[cls] || 6;
        if (cls === "footway" || cls === "steps") {
          fil.append(sv("path", { d: d(r.p), fill: "none", stroke: "#5a4a38", "stroke-opacity": 0.55, "stroke-width": w, "stroke-linecap": "round", "stroke-dasharray": "0.1 4.5" }));
          continue;
        }
        if (cls === "pedestrian") {
          fil.append(sv("path", { d: d(r.p), fill: "none", stroke: "var(--plaza-walk)", "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round" }));
          continue;
        }
        cas.append(sv("path", { d: d(r.p), fill: "none", stroke: "var(--casing)", "stroke-width": w + 3, "stroke-linecap": "round", "stroke-linejoin": "round" }));
        fil.append(sv("path", { d: d(r.p), fill: "none", stroke: "var(--street)", "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round" }));
      }
    world.append(cas, fil);
    // buildings: soft shadow + footprint; empty buildings stay off the map
    const sh = sv("g", { transform: "translate(1.6 2.4)", class: "g-bshadow" }), bl = sv("g", { class: "g-blds" });
    for (const b of GEO.buildings) {
      const inside = PLACES.filter((p) => (POI(p) || p.cat === "park" || p.cat === "wc") && pip(p.x, p.y, b.p));
      if (!inside.length && !b.pk) continue;
      const shp = sv("polygon", { points: ptsAttr(b.p), fill: "rgba(0,0,0,.55)", "fill-opacity": 0.12 }) as SVGPolygonElement;
      sh.append(shp);
      const pg = sv("polygon", { points: ptsAttr(b.p), fill: "var(--bldg)", stroke: "var(--bldg-edge)", "stroke-width": 0.8, "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" }) as SVGPolygonElement;
      const bld: Bld = { el: pg, sh: shp, pts: b.p, inside, gray: !inside.some((p) => POI(p) || p.cat === "wc"), pk: !!b.pk || inside.some((p) => p.cat === "park") };
      bl.append(pg);
      this.blds.push(bld);
      inside.forEach((p) => { if (POI(p) || !this.bldOf.has(p.id)) this.bldOf.set(p.id, bld); });
    }
    world.append(sh, bl);
    // street names along the road
    const namesG = sv("g", { "font-family": "Archivo, sans-serif", "font-size": 10, "letter-spacing": ".9", fill: "var(--label)", "font-weight": 500, "pointer-events": "none", class: "g-names" }) as SVGGElement;
    const seen: Record<string, number> = {};
    const L = (p: [number, number][]) => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };
    GEO.roads
      .filter((r) => r.n && !["service", "footway", "steps"].includes(r.c))
      .map((r) => ({ r, len: L(r.p) }))
      .sort((a, b) => b.len - a.len)
      .forEach(({ r, len }, i) => {
        if (len < 70) return;
        const key = r.n!;
        seen[key] = (seen[key] || 0) + 1;
        if (seen[key] > 3) return;
        let p = r.p;
        if (p[p.length - 1][0] < p[0][0]) p = [...p].reverse(); // left-to-right reading
        const id = "lt-rn" + i;
        namesG.append(sv("path", { id, d: d(p), fill: "none" }));
        const t = sv("text", { dy: "0.35em", "paint-order": "stroke", stroke: r.c === "pedestrian" ? "var(--plaza-walk)" : "var(--street)", "stroke-width": 3, fill: "var(--label)" });
        t.append(
          sv("textPath", { href: "#" + id, startOffset: "50%", "text-anchor": "middle" },
            r.n!.replace(/^(East|West|North|South) /, (m) => m[0] + " ").replace(/ Street$/, " St").replace(/ Avenue$/, " Ave").replace("Astronaut Ellison S Onizuka", "Onizuka").toUpperCase()),
        );
        namesG.append(t);
      });
    world.append(namesG);
    this.namesG = namesG;
    // plaza labels
    ([["WELLER COURT", -205, -82], ["HONDA PLAZA", 112, 310], ["LITTLE TOKYO GALLERIA", 138, 500], ["JANM PLAZA", 100, -22], ["NOGUCHI PLAZA", -150, 70]] as [string, number, number][]).forEach(([t, x, y]) => {
      const el = sv("text", { x, y, "font-size": 8, "text-anchor": "middle", fill: "var(--plaza-label)", "font-weight": 700, "font-family": "Archivo, sans-serif", "letter-spacing": ".8", "pointer-events": "none", class: "plbl" }, t) as SVGTextElement;
      world.append(el);
      this.plbls.push(el);
    });
    this.routeG = sv("g") as SVGGElement;
    world.append(this.routeG);
  }

  private buildPins() {
    this.pinsEl.replaceChildren();
    for (const p of PLACES) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `pin k-${p.cat}${p.legacy ? " legacy" : ""}${isClosedish(p) ? " closed" : ""}`;
      b.setAttribute("aria-label", p.name);
      const dot = document.createElement("span");
      dot.className = "b";
      dot.style.setProperty("--c", CATS[p.cat].color);
      dot.innerHTML = `<span class="gl">${svgIcon(p.glyph, 15)}</span>`;
      const lab = document.createElement("span");
      lab.className = "l";
      lab.textContent = p.cat === "park" && p.ratesShort ? p.ratesShort : p.name;
      b.append(dot, lab);
      b.addEventListener("click", (e) => {
        if (this.moved) return;
        e.stopPropagation();
        this.cb.onPinClick(p);
      });
      this.pinOf.set(p.id, b);
      this.pinsEl.append(b);
    }
  }

  /* ---------------- camera ---------------- */
  zmin = () => Math.max(this.W / (BX1 - BX0), this.H / (BY1 - BY0));
  measure() {
    const r = this.box.getBoundingClientRect();
    this.W = r.width || 390;
    this.H = r.height || 600;
  }
  private clamp() {
    const c = this.cam;
    c.z = Math.min(ZMAX, Math.max(this.zmin(), c.z));
    const hw = this.W / 2 / c.z, hh = this.H / 2 / c.z;
    c.cx = Math.min(BX1 - hw, Math.max(BX0 + hw, c.cx));
    c.cy = Math.min(BY1 - hh, Math.max(BY0 + hh, c.cy));
  }
  toScreen = (x: number, y: number): [number, number] => [(x - this.cam.cx) * this.cam.z + this.W / 2, (y - this.cam.cy) * this.cam.z + this.H / 2];
  toWorld = (sx: number, sy: number): [number, number] => [(sx - this.W / 2) / this.cam.z + this.cam.cx, (sy - this.H / 2) / this.cam.z + this.cam.cy];

  render() {
    this.clamp();
    const { cx, cy, z } = this.cam;
    this.world.setAttribute("transform", `translate(${(this.W / 2 - cx * z).toFixed(2)} ${(this.H / 2 - cy * z).toFixed(2)}) scale(${z.toFixed(4)})`);
    this.pinsEl.className = "pins " + (z < 1.1 ? "z0" : z < 2.3 ? "z1" : "z2");
    if (Math.abs(z - this.lastNameZ) / z > 0.12) {
      this.lastNameZ = z;
      this.namesG.setAttribute("font-size", (10.5 / Math.min(z, 3.2)).toFixed(2));
      this.namesG.setAttribute("stroke-width", (3 / z).toFixed(2));
      this.namesG.style.display = z < 0.8 ? "none" : "";
      this.plbls.forEach((t) => { t.setAttribute("font-size", (9.5 / Math.min(z, 3)).toFixed(2)); t.setAttribute("stroke-width", (2.6 / z).toFixed(2)); t.style.display = z < 1 ? "none" : ""; });
    }
    // parking pins show under "All" only when zoomed in
    const pz = z >= 1.6;
    if (pz !== this.parkZoomed) { this.parkZoomed = pz; if (this.st.filter === "all") this.refreshVisibility(); }
    for (const p of PLACES) {
      const pin = this.pinOf.get(p.id)!;
      const [sx, sy] = this.toScreen(p.x, p.y);
      pin.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)`;
    }
    if (this.meEl && this.me) {
      const [sx, sy] = this.toScreen(this.me.x, this.me.y);
      this.meEl.style.transform = `translate(${sx}px,${sy}px)`;
    }
    this.placeFloating();
    clearTimeout(this.labT);
    this.labT = window.setTimeout(() => this.declutter(), 90);
    const target = [10, 20, 50, 100, 200, 500].find((m) => m * z >= 48) || 500;
    this.scaleBar.style.width = (target * z).toFixed(0) + "px";
    this.scaleTxt.textContent = target + " m";
    if (this.satellite) {
      clearTimeout(this.imgT);
      this.imgT = window.setTimeout(() => this.loadImagery(), 120);
    }
  }

  /** Satellite mode: photo imagery under the map, vector ground/streets hidden (styled in map.css under .sat). */
  setSatellite(on: boolean) {
    this.satellite = on;
    this.box.classList.toggle("sat", on);
    if (on) this.loadImagery();
  }
  private loadImagery() {
    const m = 80 / this.cam.z; // preload a margin around the view
    const [x0, y0] = this.toWorld(0, 0), [x1, y1] = this.toWorld(this.W, this.H);
    this.imagery.update([x0 - m, y0 - m, x1 + m, y1 + m], this.cam.z);
  }

  flyTo(cx: number, cy: number, z: number, ms = 650) {
    cancelAnimationFrame(this.anim);
    const f = { ...this.cam }, t = { cx, cy, z: Math.min(ZMAX, Math.max(this.zmin(), z)) };
    if (prefersReducedMotion() || ms <= 0) { Object.assign(this.cam, t); this.render(); return; }
    const t0 = performance.now();
    const step = (n: number) => {
      const u = Math.min(1, (n - t0) / ms), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      this.cam.cx = f.cx + (t.cx - f.cx) * e;
      this.cam.cy = f.cy + (t.cy - f.cy) * e;
      this.cam.z = f.z + (t.z - f.z) * e;
      this.render();
      if (u < 1) this.anim = requestAnimationFrame(step);
    };
    this.anim = requestAnimationFrame(step);
  }
  fitPoints(pts: [number, number][], padTop = 140, padBot?: number) {
    if (!pts.length) return;
    const pb = padBot ?? this.cb.sheetH() + 30;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs) + 60, h = Math.max(...ys) - Math.min(...ys) + 60;
    const z = Math.min((this.W - 40) / w, (this.H - padTop - pb) / Math.max(h, 1), 4);
    this.flyTo((Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2 - (padTop - pb) / 2 / z, z, 800);
  }
  focusPlace(p: Place, sheetH: number) {
    const z = Math.max(this.cam.z, 3);
    this.flyTo(p.x, p.y + (sheetH - 110) / 2 / z, z);
  }
  zoomBy(k: number) {
    this.flyTo(this.cam.cx, this.cam.cy, this.cam.z * k, 280);
  }
  intro() {
    if (this.introDone) return;
    this.introDone = true;
    setTimeout(() => this.flyTo(-30, 15, Math.max(this.zmin() * 1.9, this.W / 330), 1500), 250);
  }

  /* ---------------- gestures: drag, pinch, wheel, double-tap ---------------- */
  private gestures() {
    const box = this.box;
    const ptrs = new Map<number, { x: number; y: number }>();
    let pan: { x: number; y: number; cx: number; cy: number } | null = null;
    let pinch: { d: number; z: number; mid: [number, number]; sm: [number, number] } | null = null;
    let lastTap = 0;
    const down = (e: PointerEvent) => {
      cancelAnimationFrame(this.anim);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) { this.moved = false; pan = { x: e.clientX, y: e.clientY, cx: this.cam.cx, cy: this.cam.cy }; }
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const r = box.getBoundingClientRect();
        const sm: [number, number] = [(a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.cam.z, mid: this.toWorld(sm[0], sm[1]), sm };
        this.moved = true;
      }
    };
    const move = (e: PointerEvent) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2 && pinch) {
        const [a, b] = [...ptrs.values()];
        this.cam.z = Math.min(ZMAX, Math.max(this.zmin(), (pinch.z * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d));
        this.cam.cx = pinch.mid[0] - (pinch.sm[0] - this.W / 2) / this.cam.z;
        this.cam.cy = pinch.mid[1] - (pinch.sm[1] - this.H / 2) / this.cam.z;
        this.render();
        return;
      }
      if (ptrs.size === 1 && pan) {
        const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
        if (Math.hypot(dx, dy) > 6) { this.moved = true; box.classList.add("drag"); }
        if (this.moved) { this.cam.cx = pan.cx - dx / this.cam.z; this.cam.cy = pan.cy - dy / this.cam.z; this.render(); }
      }
    };
    const up = (e: PointerEvent) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size) return;
      box.classList.remove("drag");
      const tgt = e.target as Element | null;
      if (!this.moved && !(tgt && tgt.closest && tgt.closest(".pin,.cluster,.stopnum"))) {
        const r = box.getBoundingClientRect();
        const now = Date.now();
        const w = this.toWorld(e.clientX - r.left, e.clientY - r.top);
        if (this.cb.onMapTap(w[0], w[1]) === "picked") {
          /* pick mode consumed it */
        } else if (now - lastTap < 300) {
          this.flyTo(w[0], w[1], this.cam.z * 1.8, 300);
        } else {
          const hit = PLACES.find((p) => POI(p) && this.bldOf.get(p.id) && pip(w[0], w[1], this.bldOf.get(p.id)!.pts));
          if (hit && this.pinVisible(hit)) this.cb.onPinClick(hit);
          else if (this.st.selected) this.cb.onEmptyTap();
        }
        lastTap = now;
      }
      pan = null;
      setTimeout(() => (this.moved = false), 0);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimationFrame(this.anim);
      const r = box.getBoundingClientRect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      const w = this.toWorld(sx, sy);
      this.cam.z = Math.min(ZMAX, Math.max(this.zmin(), this.cam.z * Math.exp(-e.deltaY * 0.0018)));
      this.cam.cx = w[0] - (sx - this.W / 2) / this.cam.z;
      this.cam.cy = w[1] - (sy - this.H / 2) / this.cam.z;
      this.render();
    };
    box.addEventListener("pointerdown", down);
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
    box.addEventListener("wheel", wheel, { passive: false });
    this.off.push(() => {
      box.removeEventListener("pointerdown", down);
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      box.removeEventListener("wheel", wheel);
    });
  }

  /* ---------------- visibility ---------------- */
  pinVisible(p: Place) {
    const s = this.st;
    if (s.planMode) return false;
    if (p.cat === "wc") return s.showWC || s.filter === "wc" || s.selected === p || s.routeTarget === p;
    if (p.cat === "park") return s.filter === "park" || s.selected === p || s.routeTarget === p || (s.filter === "all" && this.cam.z >= 1.6);
    if (p.cat === "metro") return true;
    if (isGone(p) && s.filter !== "closed") return s.selected === p;
    switch (s.filter) {
      case "all": return true;
      case "eat": case "shop": case "explore":
        return p.cat === s.filter && (!s.subs.size || s.subs.has(p.sub || "")) && waitOK(p, s.waitF, s.live);
      case "legacy": return !!p.legacy;
      case "open": return isOpen(p);
      case "park": case "wc": return false;
      case "closed": return isClosedish(p);
      default: return true;
    }
  }

  update(st: MapFilterState) {
    this.st = st;
    this.refreshVisibility();
  }

  private refreshVisibility() {
    for (const p of PLACES) {
      const pin = this.pinOf.get(p.id)!;
      pin.hidden = !this.pinVisible(p);
      pin.classList.toggle("sel", this.st.selected === p);
    }
    this.paintBuildings();
    this.render();
  }

  /** Light up only the buildings that match the chosen category; everything else stays quiet. */
  private paintBuildings() {
    const { filter, selected } = this.st;
    const active = filter !== "all";
    const match = (p: Place) => !this.pinOf.get(p.id)!.hidden && (filter === "park" ? p.cat === "park" : filter === "wc" ? p.cat === "wc" : POI(p));
    for (const b of this.blds) {
      if (b.gray) {
        const show = filter === "park";
        b.el.style.display = show ? "" : "none";
        b.sh.style.display = show ? "" : "none";
      }
      const hits = b.inside.filter(match);
      const on = hits.length > 0 && (filter !== "park" || b.pk) && (active || hits.some(POI));
      b.el.classList.toggle("on", on);
      b.el.classList.toggle("off", !on);
      b.el.classList.toggle("soft", !active && on);
      b.el.classList.remove("hl");
      if (on) {
        const cnt: Record<string, number> = {};
        hits.filter(POI).forEach((p) => (cnt[p.cat] = (cnt[p.cat] || 0) + 1));
        const main = Object.entries(cnt).sort((x, y) => y[1] - x[1])[0];
        const c = filter === "legacy" ? "var(--gold)" : filter === "park" ? CATS.park.color : filter === "wc" ? CATS.wc.color : CATS[(main ? main[0] : hits[0].cat) as Place["cat"]].color;
        b.el.style.setProperty("--c", c);
      }
    }
    for (const l of this.lots) {
      l.style.display = filter === "park" ? "" : "none";
      l.classList.toggle("on", filter === "park");
      l.classList.toggle("off", active && filter !== "park");
    }
    const sb = selected && this.bldOf.get(selected.id);
    if (sb) {
      sb.el.classList.add("hl");
      sb.el.style.setProperty("--c", CATS[selected!.cat].color);
    }
  }

  /* ---------------- clusters + labels ---------------- */
  private clusterPins() {
    this.clusters.forEach((c) => c.remove());
    this.clusters = [];
    PLACES.forEach((p) => this.pinOf.get(p.id)!.classList.remove("inclus"));
    if (this.st.planMode) { this.placeFloating(); return; }
    const z = this.cam.z;
    const R = z < 1.1 ? 30 : z < 2.3 ? 26 : 20;
    const vis = PLACES.filter((p) => !this.pinOf.get(p.id)!.hidden && p !== this.st.selected && p.cat !== "metro");
    const pts = vis.map((p) => [p, ...this.toScreen(p.x, p.y)] as [Place, number, number]);
    const used = new Set<Place>();
    for (const [p, x, y] of pts) {
      if (used.has(p)) continue;
      const grp = pts.filter(([q, qx, qy]) => !used.has(q) && q.cat === p.cat && Math.hypot(qx - x, qy - y) < R);
      if (grp.length < 2 || z >= 5) continue;
      grp.forEach(([q]) => { used.add(q); this.pinOf.get(q.id)!.classList.add("inclus"); });
      const members = grp.map((g) => g[0]);
      const cx = members.reduce((a, q) => a + q.x, 0) / members.length, cy = members.reduce((a, q) => a + q.y, 0) / members.length;
      const btn = document.createElement("button") as HTMLButtonElement & { _x: number; _y: number };
      btn.type = "button";
      btn.className = "cluster";
      btn.setAttribute("aria-label", `${members.length} ${CATS[p.cat].label.toLowerCase()} places here, tap to zoom in`);
      btn.style.setProperty("--ring", CATS[p.cat].color);
      const b = document.createElement("b");
      b.textContent = members.length > 9 ? "9+" : members.length + (members.length >= 3 ? "+" : "");
      btn.append(b);
      btn._x = cx;
      btn._y = cy;
      btn.addEventListener("click", (e) => {
        if (this.moved) return;
        e.stopPropagation();
        const xs = members.map((q) => q.x), ys = members.map((q) => q.y);
        const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 8);
        this.flyTo(cx, cy, Math.min(ZMAX, Math.max(this.cam.z * 2, (Math.min(this.W, this.H) * 0.45) / span)), 500);
      });
      this.pinsEl.append(btn);
      this.clusters.push(btn);
    }
    this.placeFloating();
  }
  private placeFloating() {
    for (const n of [...this.marks, ...this.clusters]) {
      const [sx, sy] = this.toScreen(n._x, n._y);
      n.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)`;
    }
  }
  /** Show a pin's name only where it doesn't collide with another (selected, legacy and food first). */
  private declutter() {
    this.clusterPins();
    const boxes: number[][] = [];
    const sel = this.st.selected;
    const vis = PLACES.filter((p) => { const el = this.pinOf.get(p.id)!; return !el.hidden && !el.classList.contains("inclus"); });
    const pr = (p: Place) => (p === sel ? 100 : 0) + (p.legacy ? 10 : 0) + (p.cat === "eat" ? 3 : p.cat === "shop" || p.cat === "explore" ? 2 : 0);
    vis.sort((a, b) => pr(b) - pr(a));
    for (const p of vis) {
      const [sx, sy] = this.toScreen(p.x, p.y);
      const tw = p.name.length * 6.6, w = Math.min(112, tw), lines = Math.min(2, Math.ceil(tw / 112));
      const r = [sx + 14, sy - 9, sx + 16 + w, sy - 7 + lines * 13];
      const pinR = [sx - 12, sy - 12, sx + 12, sy + 12];
      const hit = boxes.some((b) => !(r[2] < b[0] || r[0] > b[2] || r[3] < b[1] || r[1] > b[3]));
      this.pinOf.get(p.id)!.classList.toggle("nolab", hit && p !== sel);
      if (!hit) boxes.push(r);
      boxes.push(pinR);
    }
  }

  /* ---------------- me ---------------- */
  setMe(me: Me) {
    this.me = me;
    this.meEl?.remove();
    const d = document.createElement("div");
    d.className = "me";
    const s = document.createElement("span");
    s.textContent = me.label === "Metro station" ? "Start: Metro" : "You";
    d.append(s);
    this.meEl = d;
    this.pinsEl.append(d);
    this.render();
  }

  /* ---------------- routes ---------------- */
  clearRoute() {
    this.routeG.replaceChildren();
  }
  drawRoute(r: Route | null) {
    this.routeG.replaceChildren();
    this.clearMarks();
    if (!r) return;
    const d = "M" + r.pts.map((q) => q.join(" ")).join("L");
    const base = { d, fill: "none", "vector-effect": "non-scaling-stroke", "stroke-linecap": "round", "stroke-linejoin": "round" };
    this.routeG.append(sv("path", { ...base, stroke: "var(--background)", "stroke-width": 10 }));
    this.routeG.append(sv("path", { ...base, stroke: "var(--accent)", "stroke-width": 6, opacity: 0.3 }));
    this.routeG.append(sv("path", { ...base, stroke: "var(--accent)", "stroke-width": 6, "stroke-dasharray": "0.1 10" }));
    const a = r.pts[0];
    this.routeG.append(sv("circle", { cx: a[0], cy: a[1], r: 3.5, fill: "#fff", stroke: "var(--accent)", "stroke-width": 3, "vector-effect": "non-scaling-stroke" }));
  }

  clearMarks() {
    this.marks.forEach((n) => n.remove());
    this.marks = [];
  }
  /** The day plan: every walking leg, numbered stops, the active leg highlighted with its walk time. */
  drawPlan(legs: PlanLeg[], stops: Place[], park: Place | null, active: number, onStop: (p: Place) => void) {
    this.routeG.replaceChildren();
    this.clearMarks();
    legs.forEach((l, i) => {
      if (!l.r) return;
      const d = "M" + l.r.pts.map((q) => q.join(" ")).join("L");
      const on = i === active;
      const base = { d, fill: "none", "vector-effect": "non-scaling-stroke", "stroke-linecap": "round", "stroke-linejoin": "round" };
      this.routeG.append(sv("path", { ...base, stroke: on ? "#fff" : "var(--surface)", "stroke-width": on ? 12 : 7, opacity: active < 0 || on ? 0.95 : 0.45 }));
      this.routeG.append(sv("path", { ...base, stroke: "var(--accent)", "stroke-width": on ? 6 : 4, opacity: active < 0 || on ? 1 : 0.3, "stroke-dasharray": on ? "none" : "0.1 9" }));
      if (on) {
        const m = l.r.pts[Math.floor(l.r.pts.length / 2)];
        const tag = document.createElement("div") as unknown as HTMLElement & { _x: number; _y: number };
        tag.className = "legtag";
        tag.textContent = fmtMin(l.r.meters) + " walk";
        tag._x = m[0];
        tag._y = m[1];
        this.pinsEl.append(tag);
        this.marks.push(tag);
      }
    });
    const activeFrom = active >= 0 ? legs[active].a : null;
    const mk = (p: Place, label: string, aria: string, pk: boolean) => {
      const n = document.createElement("button") as HTMLButtonElement & { _x: number; _y: number };
      n.type = "button";
      n.className = "stopnum" + (pk ? " pk" : "") + (activeFrom === p ? " on" : "");
      n.setAttribute("aria-label", aria);
      n.textContent = label;
      n.addEventListener("click", (e) => { e.stopPropagation(); if (this.moved) return; onStop(p); });
      n._x = p.x;
      n._y = p.y;
      this.pinsEl.append(n);
      this.marks.push(n);
    };
    stops.forEach((p, i) => mk(p, String(i + 1), `Stop ${i + 1}: ${p.name}`, false));
    if (park) mk(park, "P", "Parking: " + park.name, true);
    this.placeFloating();
  }
}
