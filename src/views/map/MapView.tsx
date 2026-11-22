import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button, Header, ListBox, SearchField, Select, Separator, Surface } from "@heroui/react";
import { CatDot } from "@/components/common";
import { BY, CATS, PARKING, PLACES, POI, SUBS, WCS } from "@/lib/data";
import { openState } from "@/lib/hours";
import { Icon } from "@/lib/icons";
import { nearest, route, type Route } from "@/lib/route";
import { store } from "@/lib/storage";
import { cx } from "@/lib/cx";
import { iterationHas } from "@/lib/iterations";
import { IMAGERY_CREDIT } from "./imagery";
import { consumeMapCmd, getState, setMe, toast, useApp, useFeature } from "@/state/store";
import { EventDetailBody, EventsBody } from "@/views/EventsView";
import type { Cat, EventItem, Me, Place, Plan } from "@/lib/types";
import { MapEngine, type PlanLeg } from "./engine";
import { Chips, TypeFilter } from "./FilterBar";
import { PlaceSheet, PlanSheet, RoutePanel, type PlanState, type SheetActions } from "./PlaceSheet";
import "./map.css";

type Mode =
  | { kind: "place" }
  | { kind: "route"; fromName: string; from: Place | Me; to: Place | Me; r: Route; label?: string }
  | { kind: "plan" }
  | { kind: "event"; e: EventItem }
  | null;

const isPlace = (x: Place | Me | null | undefined): x is Place => !!x && "cat" in x;
const heightsFor = (H: number) => [0, Math.min(250, H * 0.42), Math.round(H * 0.6), H - 8];
/** The events sheet (iteration 4) never closes: peek shows its title and category pills. */
const evHeightsFor = (H: number) => [0, Math.min(156, H * 0.3), Math.round(H * 0.6), H - 8];
const DIR_GROUPS: [Cat, string][] = [["eat", "Eat"], ["shop", "Shop"], ["explore", "Explore"], ["park", "Parking"], ["wc", "Restrooms"], ["metro", "Transit"]];

export default function MapView({ active }: { active: boolean }) {
  const me = useApp((s) => s.me);
  const live = useApp((s) => s.live);
  const mapCmd = useApp((s) => s.mapCmd);
  const satellite = useApp((s) => iterationHas(s.iteration, "satellite"));
  const evMode = useFeature("eventsSheet");
  const chipsMode = useFeature("mapChips");

  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const pinsRef = useRef<HTMLDivElement>(null);
  const scaleBarRef = useRef<HTMLElement>(null);
  const scaleTxtRef = useRef<HTMLSpanElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const engRef = useRef<MapEngine | null>(null);
  const evRef = useRef<HTMLDivElement>(null);
  const evBodyRef = useRef<HTMLDivElement>(null);
  const evModeRef = useRef(evMode);
  evModeRef.current = evMode;
  const pickRef = useRef(false);

  const [H, setH] = useState(600);
  const [filter, setFilter] = useState("all");
  const [subs, setSubsState] = useState<Set<string>>(() => new Set());
  const [waitF, setWaitF] = useState("any");
  const [fpOpen, setFpOpen] = useState(false);
  const [showWC, setShowWC] = useState(false);
  const [selected, setSelected] = useState<Place | null>(null);
  const [routeTarget, setRouteTarget] = useState<Place | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [tab, setTab] = useState("overview");
  const [sheetState, setSheetState] = useState(0);
  const sheetStateRef = useRef(0);
  const [evState, setEvState] = useState(1);
  const evStateRef = useRef(1);
  const [dir, setDir] = useState<{ from: string; to: string } | null>(null);
  const [pv, setPv] = useState<PlanState | null>(null);
  const [q, setQ] = useState("");
  const [resOpen, setResOpen] = useState(false);

  const HRef = useRef(H);
  HRef.current = H;
  const heights = () => heightsFor(engRef.current?.H ?? HRef.current);
  const evHeights = () => (evModeRef.current ? evHeightsFor(engRef.current?.H ?? HRef.current) : [0, 0, 0, 0]);
  /** Height of whatever sheet covers the bottom of the map (the detail sheet sits over the events sheet). */
  const sheetH = () => Math.max(heights()[sheetStateRef.current] || 0, evHeights()[evStateRef.current] || 0);

  function setSheet(s: number) {
    sheetStateRef.current = s;
    setSheetState(s);
    if (sheetRef.current) sheetRef.current.style.height = heights()[s] + "px";
  }
  function setEv(s: number) {
    evStateRef.current = s;
    setEvState(s);
    if (evRef.current) evRef.current.style.height = evHeights()[s] + "px";
  }
  function openEvent(e: EventItem) {
    clearPlan();
    setDir(null);
    setSelected(null);
    setRouteTarget(null);
    engRef.current?.clearRoute();
    setMode({ kind: "event", e });
    setSheet(3);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }

  /* ---------------- actions (fresh closures every render, read through actRef) ---------------- */
  const fromNameOf = (from: Place | Me) => (isPlace(from) ? from.name : me.label === "Metro station" ? "Metro station" : "Your spot");

  function clearPlan() {
    setPv(null);
    engRef.current?.clearMarks();
  }
  function openPlace(p: Place) {
    clearPlan();
    setSelected(p);
    setRouteTarget(null);
    engRef.current?.clearRoute();
    setMode({ kind: "place" });
    setTab("overview");
    setSheet(2);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    engRef.current?.focusPlace(p, heights()[2]);
    setResOpen(false);
  }
  function closeSheet() {
    clearPlan();
    setSelected(null);
    setRouteTarget(null);
    engRef.current?.clearRoute();
    setMode(null);
    setSheet(0);
  }
  function showRouteBetween(a: Place | Me, b: Place | Me, label?: string) {
    const r = route(a, b);
    if (!r) {
      toast("No walking route found");
      return;
    }
    clearPlan();
    setRouteTarget(isPlace(b) && (b.cat === "park" || b.cat === "wc") ? b : isPlace(a) && a.cat === "park" ? a : null);
    engRef.current?.drawRoute(r);
    setSheet(2);
    setMode({ kind: "route", fromName: fromNameOf(a), from: a, to: b, r, label });
    engRef.current?.fitPoints(r.pts);
  }
  function showNearest(p: Place, kind: "park" | "wc") {
    const list = kind === "park" ? PARKING : WCS;
    const n = list.length ? nearest(p, list) : null;
    if (!n) {
      toast("None found nearby");
      return;
    }
    if (kind === "wc") setShowWC(true);
    showRouteBetween(kind === "park" ? n.p : p, kind === "park" ? p : n.p, kind === "park" ? "Nearest parking" : "Nearest restroom");
  }
  const pick = (v: string): Place | Me => (v === "__me" ? me : BY[v]);
  function runDirections(fromId: string, toId: string) {
    const a = pick(fromId), b = pick(toId);
    if (a === b) {
      toast("Pick two different places");
      return;
    }
    const r = route(a, b);
    if (!r) return;
    clearPlan();
    setSelected(isPlace(b) ? b : null);
    setRouteTarget(null);
    engRef.current?.drawRoute(r);
    setSheet(2);
    setMode({ kind: "route", fromName: fromNameOf(a), from: a, to: b, r });
    engRef.current?.fitPoints(r.pts, 190);
  }
  function startDirections(to: Place, from?: Place) {
    const d = { from: from ? from.id : "__me", to: to.id };
    setDir(d);
    setResOpen(false);
    runDirections(d.from, d.to);
  }
  function exitDirections() {
    setDir(null);
    engRef.current?.clearRoute();
  }

  /* the day plan on the map */
  function drawPlan(s: PlanState) {
    engRef.current?.drawPlan(s.legs, s.stops, s.park, s.active, (p) => actRef.current.focusLeg(s.legs.findIndex((l) => l.a === p)));
  }
  function showPlan(plan: Plan) {
    setDir(null);
    setSelected(null);
    setRouteTarget(null);
    const stops = plan.stops.map((s) => BY[s.id]).filter(Boolean);
    const park = plan.park ? BY[plan.park] || null : null;
    const seq: Place[] = [...(park ? [park] : []), ...stops, ...(park ? [park] : [])];
    const legs: PlanLeg[] = [];
    if (!park && seq.length) legs.push({ a: me, b: seq[0], r: route(me, seq[0]), start: true });
    for (let i = 0; i < seq.length - 1; i++) legs.push({ a: seq[i], b: seq[i + 1], r: route(seq[i], seq[i + 1]) });
    const s: PlanState = { stops, park, legs, active: -1, times: Object.fromEntries(plan.stops.map((x) => [x.id, x.time])) };
    setPv(s);
    drawPlan(s);
    setMode({ kind: "plan" });
    setSheet(2);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    engRef.current?.fitPoints(legs.flatMap((l) => (l.r ? l.r.pts : [])));
  }
  function focusLeg(i: number) {
    if (!pv) return;
    const l = pv.legs[i];
    if (!l) {
      toast("That's the last stop. Enjoy!");
      return;
    }
    const s = { ...pv, active: i };
    setPv(s);
    drawPlan(s);
    if (l.r) engRef.current?.fitPoints(l.r.pts, 150, sheetH() + 30);
  }
  function wholeRoute() {
    if (!pv) return;
    const s = { ...pv, active: -1 };
    setPv(s);
    drawPlan(s);
    engRef.current?.fitPoints(pv.legs.flatMap((l) => (l.r ? l.r.pts : [])));
  }

  const actions: SheetActions = { openPlace, startDirections, showNearest, showRouteBetween };
  const actRef = useRef({ ...actions, closeSheet, focusLeg, showPlan, selected, setEv, sheetH });
  actRef.current = { ...actions, closeSheet, focusLeg, showPlan, selected, setEv, sheetH };

  /* ---------------- engine lifecycle ---------------- */
  useLayoutEffect(() => {
    const eng = new MapEngine({
      svg: svgRef.current!, world: worldRef.current!, box: boxRef.current!, pins: pinsRef.current!,
      scaleBar: scaleBarRef.current!, scaleTxt: scaleTxtRef.current!,
      cb: {
        onPinClick: (p) => actRef.current.openPlace(p),
        onMapTap: (x, y) => {
          if (!pickRef.current) return;
          pickRef.current = false;
          setMe(x, y);
          return "picked";
        },
        onEmptyTap: () => {
          // like Google Maps: a tap on the map closes the detail sheet, or else lowers the events sheet
          if (sheetStateRef.current) actRef.current.closeSheet();
          else if (evStateRef.current > 1) actRef.current.setEv(1);
        },
        sheetH: () => actRef.current.sheetH(),
      },
    });
    engRef.current = eng;
    eng.setMe(getState().me);
    setH(eng.H);
    const ro = new ResizeObserver(() => {
      eng.measure();
      eng.render();
      setH(eng.H);
      if (sheetRef.current) sheetRef.current.style.height = heightsFor(eng.H)[sheetStateRef.current] + "px";
      if (evRef.current) evRef.current.style.height = (evModeRef.current ? evHeightsFor(eng.H)[evStateRef.current] : 0) + "px";
    });
    ro.observe(boxRef.current!);
    return () => {
      ro.disconnect();
      eng.destroy();
      engRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engRef.current?.update({ filter, subs, waitF, showWC, selected, routeTarget, planMode: !!pv, live });
  }, [filter, subs, waitF, showWC, selected, routeTarget, pv, live]);

  useEffect(() => {
    engRef.current?.setMe(me);
  }, [me]);

  useEffect(() => {
    engRef.current?.setSatellite(satellite);
  }, [satellite]);

  // switching iterations shows or hides the events sheet
  useEffect(() => {
    setEv(evMode ? Math.max(1, evStateRef.current) : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evMode]);

  // the section is display:none while another view is showing: re-measure when it comes back
  useEffect(() => {
    if (!active) {
      setFpOpen(false);
      return;
    }
    const id = requestAnimationFrame(() => {
      const eng = engRef.current;
      if (!eng) return;
      eng.measure();
      eng.render();
      setH(eng.H);
      if (sheetRef.current) sheetRef.current.style.height = heightsFor(eng.H)[sheetStateRef.current] + "px";
      if (evRef.current) evRef.current.style.height = (evModeRef.current ? evHeightsFor(eng.H)[evStateRef.current] : 0) + "px";
      if (!getState().mapCmd) eng.intro();
    });
    return () => cancelAnimationFrame(id);
  }, [active]);

  // commands from other views: open a place, or show a day plan
  useEffect(() => {
    if (!active || !mapCmd) return;
    const id = requestAnimationFrame(() => {
      const eng = engRef.current;
      if (!eng) return;
      eng.measure();
      eng.introDone = true;
      if (mapCmd.kind === "open") {
        const p = BY[mapCmd.id];
        if (p) {
          setDir(null);
          actRef.current.openPlace(p);
        }
      } else actRef.current.showPlan(mapCmd.plan);
      consumeMapCmd();
    });
    return () => cancelAnimationFrame(id);
  }, [active, mapCmd]);

  /* ---------------- sheet drag (detail sheet + events sheet) ---------------- */
  const drag = useRef<{ y: number; h: number } | null>(null);
  function grabHandlers(
    ref: React.RefObject<HTMLDivElement | null>, hsOf: () => number[], cur: () => number, set: (s: number) => void, onClose: () => void,
  ) {
    return {
      onPointerDown: (e: React.PointerEvent) => {
        drag.current = { y: e.clientY, h: ref.current!.getBoundingClientRect().height };
        ref.current!.classList.add("nodrag");
        (e.target as Element).setPointerCapture(e.pointerId);
      },
      onPointerMove: (e: React.PointerEvent) => {
        const d = drag.current;
        if (!d) return;
        ref.current!.style.height = Math.max(60, Math.min(hsOf()[3], d.h - (e.clientY - d.y))) + "px";
      },
      onPointerUp: (e: React.PointerEvent) => {
        const d = drag.current;
        if (!d) return;
        drag.current = null;
        const el = ref.current!;
        el.classList.remove("nodrag");
        const h = el.getBoundingClientRect().height;
        const hs = hsOf();
        if (Math.abs(e.clientY - d.y) <= 6) {
          set(cur() === 3 ? 2 : 3);
          return;
        }
        if (h < hs[1] * 0.6) {
          onClose();
          return;
        }
        let best = 1, bd = 1e9;
        hs.forEach((v, i) => {
          if (i && Math.abs(v - h) < bd) {
            bd = Math.abs(v - h);
            best = i;
          }
        });
        set(best);
      },
    };
  }
  const sheetGrab = grabHandlers(sheetRef, heights, () => sheetStateRef.current, setSheet, closeSheet);
  const evGrab = grabHandlers(evRef, evHeights, () => evStateRef.current, setEv, () => setEv(1));

  /* ---------------- chips + search ---------------- */
  function pickChip(k: string) {
    const f = filter === k && k !== "all" ? "all" : k;
    setFilter(f);
    setSubsState(new Set());
    setWaitF("any");
    setFpOpen(false);
    store.set("lt-filter", f);
    store.set("lt-subs", []);
    if (f === "park") toast("Tap a garage for rates.");
    if (f === "wc") toast("Tap one for access.");
    if (k === "open") toast(`${PLACES.filter((p) => POI(p) && openState(p).k === "y").length} places open right now`);
  }
  const setSubs = (s: Set<string>) => {
    setSubsState(s);
    store.set("lt-subs", [...s]);
  };

  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return PLACES.filter((p) => (p.name + " " + (p.type || "") + " " + p.tags.join(" ") + " " + (p.desc || "") + " " + (p.knownFor || []).join(" ")).toLowerCase().includes(t)).slice(0, 8);
  }, [q]);

  const fabBottom = Math.min(Math.max(heights()[sheetState], evHeights()[evState] || 0), H * 0.62);
  const topHidden = sheetState === 3 || (evMode && evState === 3 && !sheetState);
  const dirOptions = useMemo(
    () => DIR_GROUPS.map(([k, l]) => [l, PLACES.filter((p) => p.cat === k).sort((a, b) => a.name.localeCompare(b.name))] as [string, Place[]]).filter(([, items]) => items.length),
    [],
  );
  const fabCls = "size-11 rounded-full bg-surface text-foreground shadow-[var(--overlay-shadow)]";

  return (
    <div className="absolute inset-0" style={{ background: "var(--ground)" }}>
      <div ref={boxRef} className="mapbox" aria-label="Map of Little Tokyo">
        <svg ref={svgRef}>
          <g ref={worldRef} />
        </svg>
        <div ref={pinsRef} className="pins" />
      </div>

      {/* top: search or directions, then chips */}
      <div className="pointer-events-none absolute inset-x-2.5 top-2.5 z-10 flex flex-col gap-2 *:pointer-events-auto" style={{ visibility: topHidden ? "hidden" : "visible" }}>
        {!dir ? (
          <div className="relative">
            <SearchField
              aria-label="Search places"
              value={q}
              onChange={(v) => {
                setQ(v);
                setResOpen(!!v.trim());
              }}
              onClear={() => setResOpen(false)}
              className="w-full"
            >
              <SearchField.Group className="bg-surface h-12 rounded-full px-1.5 shadow-[var(--overlay-shadow)]">
                <SearchField.SearchIcon className="ml-2" />
                <SearchField.Input placeholder="Search Little Tokyo" autoComplete="off" className="text-base" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            {resOpen && (
              <Surface className="mt-2 max-h-[330px] overflow-y-auto rounded-3xl p-1.5 shadow-[var(--overlay-shadow)]">
                {hits.length ? (
                  hits.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="hover:bg-default/70 flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
                      onClick={() => {
                        setQ(p.name);
                        setResOpen(false);
                        (document.activeElement as HTMLElement | null)?.blur();
                        openPlace(p);
                      }}
                    >
                      <CatDot p={p} size={32} icon={15} />
                      <span className="min-w-0">
                        <b className="block truncate text-sm font-semibold">{p.name}</b>
                        <small className="text-muted block truncate text-[12.5px]">
                          {[p.type || CATS[p.cat].label, p.legacy ? "★ Legacy" : null, POI(p) ? openState(p).t : null].filter(Boolean).join(" · ")}
                        </small>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="text-muted px-3 py-3 text-sm">No matches in Little Tokyo</div>
                )}
              </Surface>
            )}
          </div>
        ) : (
          <Surface className="grid grid-cols-[18px_1fr_auto] items-center gap-x-2.5 gap-y-1.5 rounded-3xl py-2.5 pr-2 pl-3.5 shadow-[var(--overlay-shadow)]">
            <div className="row-span-2 flex flex-col items-center gap-[3px]">
              <i className="border-muted size-[10px] rounded-full border-2" />
              <b className="h-3.5 w-0.5" style={{ background: "repeating-linear-gradient(var(--muted) 0 2px,transparent 2px 4px)" }} />
              <i className="border-accent bg-accent size-[10px] rounded-full border-2" />
            </div>
            <DirSelect label="Start" value={dir.from} me={me} groups={dirOptions} onChange={(v) => { setDir({ ...dir, from: v }); runDirections(v, dir.to); }} />
            <div className="row-span-2 flex flex-col gap-1.5">
              <Button isIconOnly size="sm" variant="tertiary" className="rounded-full" aria-label="Swap start and destination" onPress={() => { const d = { from: dir.to, to: dir.from }; setDir(d); runDirections(d.from, d.to); }}>
                <span className="text-base leading-none">⇅</span>
              </Button>
              <Button isIconOnly size="sm" variant="tertiary" className="rounded-full" aria-label="Close directions" onPress={() => { exitDirections(); closeSheet(); }}>
                <span className="text-sm leading-none">✕</span>
              </Button>
            </div>
            <DirSelect label="Destination" value={dir.to} me={me} groups={dirOptions} onChange={(v) => { setDir({ ...dir, to: v }); runDirections(dir.from, v); }} />
          </Surface>
        )}
        {!dir && <Chips filter={filter} onPick={pickChip} front={chipsMode ? ["park", "wc"] : []} />}
        {!dir && SUBS[filter as Cat] && (
          <div className="-mt-1">
            <TypeFilter filter={filter as Cat} subs={subs} waitF={waitF} open={fpOpen} setOpen={setFpOpen} setSubs={setSubs} setWaitF={setWaitF} />
          </div>
        )}
      </div>

      {/* floating buttons */}
      <div className="mapfloat absolute right-2.5 z-[9] flex flex-col gap-2" style={{ bottom: fabBottom + 26, visibility: sheetState >= 2 || evState >= 2 ? "hidden" : "visible" }}>
        <Button isIconOnly variant="tertiary" className={fabCls} aria-label="Set where I am" onPress={() => { pickRef.current = true; toast("Tap the map where you are"); }}>
          <Icon name="pin" size={20} />
        </Button>
        {!chipsMode && (
          <>
        <Button
          isIconOnly
          variant={showWC ? "primary" : "tertiary"}
          className={cx(fabCls, showWC && "bg-accent text-accent-foreground")}
          aria-label="Nearest restroom"
          onPress={() => {
            const from = selected && selected.cat !== "wc" ? selected : me;
            const n = nearest(from, WCS);
            if (!n) return;
            setShowWC(true);
            setSelected(null);
            showRouteBetween(from, n.p, "Nearest restroom");
          }}
        >
          <Icon name="wc" size={20} />
        </Button>
        <Button
          isIconOnly
          variant="tertiary"
          className={fabCls}
          aria-label="Nearest parking"
          onPress={() => {
            const t = selected && selected.cat !== "park" ? selected : me;
            const n = nearest(t, PARKING);
            if (!n) return;
            setSelected(null);
            showRouteBetween(n.p, t, "Nearest parking");
          }}
        >
          <Icon name="park" size={20} />
        </Button>
        <div className="bg-surface flex flex-col overflow-hidden rounded-full shadow-[var(--overlay-shadow)]">
          <Button isIconOnly variant="ghost" className="size-11 rounded-none text-xl font-bold" aria-label="Zoom in" onPress={() => engRef.current?.zoomBy(1.6)}>
            +
          </Button>
          <Separator className="mx-2.5 w-auto" />
          <Button isIconOnly variant="ghost" className="size-11 rounded-none text-xl font-bold" aria-label="Zoom out" onPress={() => engRef.current?.zoomBy(1 / 1.6)}>
            −
          </Button>
        </div>
          </>
        )}
      </div>

      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener"
        className="mapfloat text-muted absolute right-1.5 z-[8] rounded-full bg-[var(--glass)] px-1.5 py-px text-[9.5px] no-underline"
        style={{ bottom: fabBottom + 4 }}
      >
        {satellite ? `${IMAGERY_CREDIT} · © OpenStreetMap` : "© OpenStreetMap"}
      </a>
      <div className="mapfloat text-muted pointer-events-none absolute left-3 z-[8] flex flex-col gap-0.5 text-[10px] font-medium" style={{ bottom: fabBottom + 14 }}>
        <span ref={scaleTxtRef}>100 m</span>
        <i ref={scaleBarRef} className="block h-[5px] border-[1.5px] border-t-0 border-current" style={{ width: 60 }} />
      </div>

      {/* events sheet (iteration 4): always there under the map, like Google Maps' explore sheet */}
      {evMode && (
        <div
          ref={evRef}
          className="mapsheet bg-overlay absolute inset-x-0 bottom-0 z-[19] flex flex-col rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,.14)]"
          style={{ height: 0 }}
          aria-label="Events"
        >
          <div className="flex flex-none cursor-grab touch-none justify-center pt-2 pb-1" {...evGrab} onPointerCancel={evGrab.onPointerUp}>
            <i className="bg-default h-[5px] w-10 rounded-full" />
          </div>
          <div
            ref={evBodyRef}
            className={cx("min-h-0 flex-1 overscroll-contain px-4 pt-1 pb-8", evState >= 2 ? "overflow-y-auto" : "overflow-hidden")}
            onClick={() => { if (evStateRef.current < 2) setEv(2); }}
          >
            <EventsBody compact onOpen={openEvent} />
          </div>
        </div>
      )}

      {/* detail sheet (place, route, plan, event): slides over the events sheet */}
      <div
        ref={sheetRef}
        className="mapsheet bg-overlay absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,.14)]"
        style={{ height: 0 }}
      >
        <div className="flex flex-none cursor-grab touch-none justify-center pt-2 pb-1" {...sheetGrab} onPointerCancel={sheetGrab.onPointerUp}>
          <i className="bg-default h-[5px] w-10 rounded-full" />
        </div>
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {mode?.kind === "place" && selected && <PlaceSheet p={selected} tab={tab} setTab={setTab} actions={actions} />}
          {mode?.kind === "event" && <EventDetailBody e={mode.e} onClose={closeSheet} />}
          {mode?.kind === "route" && (
            <RoutePanel
              fromName={mode.fromName}
              to={mode.to}
              r={mode.r}
              label={mode.label}
              onBack={() => {
                exitDirections();
                const { from, to } = mode;
                const target = isPlace(to) && to.cat === "park" && isPlace(from) && POI(from) ? from : to;
                if (isPlace(target)) openPlace(target);
                else closeSheet();
              }}
            />
          )}
          {mode?.kind === "plan" && pv && (
            <PlanSheet
              pv={pv}
              me={me}
              focusLeg={focusLeg}
              wholeRoute={wholeRoute}
              close={closeSheet}
              details={(p) => {
                clearPlan();
                openPlace(p);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DirSelect({
  label, value, me, groups, onChange,
}: { label: string; value: string; me: Me; groups: [string, Place[]][]; onChange: (v: string) => void }) {
  return (
    <Select aria-label={label} value={value} onChange={(k) => k != null && onChange(String(k))} className="w-full min-w-0">
      <Select.Trigger className="bg-field h-9 min-h-9 rounded-xl text-[15px]">
        <Select.Value className="truncate" />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="max-h-[320px]">
        <ListBox>
          <ListBox.Item id="__me" textValue={me.label === "Metro station" ? "Metro station (start)" : "My spot"}>
            {me.label === "Metro station" ? "Metro station (start)" : "My spot"}
            <ListBox.ItemIndicator />
          </ListBox.Item>
          {groups.map(([l, items]) => (
            <ListBox.Section key={l}>
              <Header>{l}</Header>
              {items.map((p) => (
                <ListBox.Item key={p.id} id={p.id} textValue={p.name}>
                  {p.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox.Section>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
