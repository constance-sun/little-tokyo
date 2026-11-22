import type { ReactNode } from "react";
import { Alert, Button, Chip, Table, Tabs } from "@heroui/react";
import { LegacyChip, ListRow } from "@/components/common";
import { OwnerBox } from "@/views/account/OwnerBox";
import { CATS, METRO_DESC, PARKING, PLACES, POI, WCS } from "@/lib/data";
import { DAYN, DAYS, hoursText, laNow, openState } from "@/lib/hours";
import { Icon } from "@/lib/icons";
import { domain, fmtM, fmtMin } from "@/lib/format";
import { nearest, stepName, walkM, type Route } from "@/lib/route";
import { waitSummary } from "@/lib/waits";
import { cx } from "@/lib/cx";
import { toast, toggleSaved, useApp, useFeature } from "@/state/store";
import type { Me, Place } from "@/lib/types";
import type { PlanLeg } from "./engine";

export interface SheetActions {
  openPlace(p: Place): void;
  startDirections(to: Place): void;
  showNearest(p: Place, kind: "park" | "wc"): void;
  showRouteBetween(a: Place | Me, b: Place | Me, label?: string): void;
}

export async function copy(t: string, msg: string) {
  try {
    await navigator.clipboard.writeText(t);
    toast(msg);
  } catch {
    toast(t);
  }
}

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener" className="text-accent font-medium no-underline hover:underline">
    {children}
  </a>
);

/* ---------------- shared bits ---------------- */
function IRow({ ic, children, right }: { ic: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="border-separator grid grid-cols-[32px_1fr_auto] items-start gap-3 border-b py-3 text-sm last:border-b-0 [&_small]:text-muted [&_small]:block [&_small]:text-[12.5px]">
      <span className="bg-accent-soft text-accent grid size-8 place-items-center rounded-full">
        <Icon name={ic} size={16} />
      </span>
      <div className="min-w-0 self-center">{children}</div>
      {right || <span />}
    </div>
  );
}
function MiniBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button size="sm" variant="tertiary" className="h-7 rounded-full px-3 text-xs font-semibold" onPress={onClick}>
      {children}
    </Button>
  );
}
function Banner({ tone = "bad", title, children }: { tone?: "bad" | "warn" | "muted"; title: string; children?: ReactNode }) {
  return (
    <Alert status={tone === "bad" ? "danger" : tone === "warn" ? "warning" : "default"} className="mx-4 mt-3 w-auto rounded-2xl">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        {children && <Alert.Description>{children}</Alert.Description>}
      </Alert.Content>
    </Alert>
  );
}

function PhotoStrip({ p }: { p: Place }) {
  const ph = p.photos;
  if (!ph.length)
    return (
      <div className="px-3.5">
        <figure className="bg-surface-secondary relative m-0 h-[160px] w-full overflow-hidden rounded-2xl">
          <div className="text-muted flex size-full flex-col items-center justify-center gap-2 text-xs font-medium">
            <span className="grid size-16 place-items-center rounded-full" style={{ background: CATS[p.cat].color }}>
              <Icon name={p.glyph} size={36} stroke="#fff" />
            </span>
            <span>Photo coming soon</span>
          </div>
        </figure>
      </div>
    );
  return (
    <div className="no-scrollbar flex snap-x snap-mandatory scroll-px-3.5 gap-2 overflow-x-auto px-3.5">
      {ph.map((x, i) => (
        <figure key={i} className={cx("bg-surface-secondary relative m-0 h-[160px] flex-none snap-start overflow-hidden rounded-2xl", ph.length === 1 ? "w-full" : "w-[236px]")}>
          <img src={x.src} alt={x.caption || x.subject || p.name} loading="lazy" className="block size-full object-cover" />
          <figcaption className="absolute inset-x-0 bottom-0 flex flex-col gap-px bg-gradient-to-b from-transparent to-black/70 px-3 pt-6 pb-2 text-[10px] leading-[1.3] text-white">
            {x.caption && <b className="text-xs">{x.caption}</b>}
            <span>
              {(x.author || "Wikimedia Commons") + " · "}
              <a href={x.source} target="_blank" rel="noopener" className="text-white">
                {x.license || "license"}
              </a>
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function Act({ label, ic, onClick, primary, on }: { label: string; ic: string; onClick: () => void; primary?: boolean; on?: boolean }) {
  return (
    <div className="flex min-w-[60px] flex-none flex-col items-center gap-1.5">
      <Button
        isIconOnly
        aria-label={label}
        variant={primary ? "primary" : "tertiary"}
        className={cx("size-12 rounded-full", on && "bg-gold-soft text-gold")}
        onPress={onClick}
      >
        <Icon name={ic} size={19} fill={on ? "currentColor" : "none"} />
      </Button>
      <span aria-hidden className={cx("text-xs font-semibold", primary ? "text-accent" : "text-foreground/80")}>
        {label}
      </span>
    </div>
  );
}

/* ---------------- the place sheet ---------------- */
export function PlaceSheet({ p, tab, setTab, actions }: { p: Place; tab: string; setTab: (t: string) => void; actions: SheetActions }) {
  const me = useApp((s) => s.me);
  const live = useApp((s) => s.live);
  const saved = useApp((s) => s.saved);
  const st = POI(p) ? openState(p) : null;
  const fromMe = walkM(me, p);
  const ws = p.cat === "eat" ? waitSummary(p, live) : null;
  const isSaved = saved.includes(p.id);
  const noAccount = useFeature("noAccount");
  return (
    <>
      <PhotoStrip p={p} />
      <div className="px-4 pt-3">
        <h2 className="font-display m-0 text-[24px] leading-[1.15] font-extrabold tracking-[-0.03em]">{p.name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Chip size="sm" variant="secondary" className="gap-1.5 pl-1">
            <span className="grid size-[18px] place-items-center rounded-full" style={{ background: CATS[p.cat].color }}>
              <Icon name={p.glyph} size={11} stroke="#fff" />
            </span>
            {[p.type || CATS[p.cat].label, p.price].filter(Boolean).join(" · ")}
          </Chip>
          {p.legacy && <LegacyChip since={p.since} />}
          {st && (
            <Chip size="sm" variant="soft" color={st.k === "y" ? "success" : st.k === "n" ? "danger" : "default"} className="font-semibold">
              {st.t}
            </Chip>
          )}
          {ws && (
            <Chip size="sm" variant="soft" color={ws.live ? "success" : "accent"} className="gap-1.5 font-semibold">
              {ws.live ? <i className="bg-success pulse-soft size-2 rounded-full" /> : "⏱"}
              {ws.t}
            </Chip>
          )}
        </div>
        <div className="text-muted mt-1.5 text-[13px]">
          {fmtMin(fromMe)} walk from {me.label === "Metro station" ? "the Metro" : "you"}
        </div>
      </div>
      {(p.status === "closed_permanently" || p.status === "moved") && (
        <Banner title={p.status === "moved" ? "Moved away" : "Permanently closed"}>
          {p.statusNote || "Still printed on the official map, but reported closed."}
        </Banner>
      )}
      {p.status === "temp_closed" && (
        <Banner tone="warn" title="Temporarily closed">
          {p.statusNote || null}
        </Banner>
      )}
      {p.status === "unknown" && POI(p) && (
        <Banner tone="muted" title="Status not confirmed">
          We couldn't confirm this business is still open.
        </Banner>
      )}
      <div className="no-scrollbar flex gap-1 overflow-x-auto px-3 pt-4 pb-1">
        <Act label="Directions" ic="dir" primary onClick={() => actions.startDirections(p)} />
        {p.cat !== "park" && <Act label="Parking" ic="park" onClick={() => actions.showNearest(p, "park")} />}
        {p.cat !== "wc" && <Act label="Restroom" ic="wc" onClick={() => actions.showNearest(p, "wc")} />}
        {!noAccount && <Act label={isSaved ? "Saved" : "Save"} ic="star" on={isSaved} onClick={() => toggleSaved(p.id)} />}
        <Act label="Copy" ic="copy" onClick={() => copy(p.name + ", " + (p.address || "Little Tokyo, Los Angeles"), "Address copied")} />
      </div>
      {p.cat === "park" || p.cat === "wc" || p.cat === "metro" ? (
        <SimpleInfo p={p} />
      ) : (
        <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))} className="mt-3 w-full">
          <Tabs.ListContainer className="bg-overlay sticky top-0 z-[2] px-4 pb-1">
            <Tabs.List aria-label="Place details" className="w-full">
              {[["overview", "Overview"], ["about", "About"], ["story", "Their story"]].map(([k, l]) => (
                <Tabs.Tab key={k} id={k} className="flex-1 text-[13px] font-semibold">
                  {l}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="overview" className="px-4 pt-1 pb-6">
            <Overview p={p} actions={actions} />
          </Tabs.Panel>
          <Tabs.Panel id="about" className="px-4 pt-1 pb-6">
            <About p={p} />
          </Tabs.Panel>
          <Tabs.Panel id="story" className="px-4 pt-1 pb-6">
            <Story p={p} />
          </Tabs.Panel>
        </Tabs>
      )}
    </>
  );
}

function Overview({ p, actions }: { p: Place; actions: SheetActions }) {
  const live = useApp((s) => s.live);
  const noAccount = useFeature("noAccount");
  const { d } = laNow();
  const ws = p.cat === "eat" ? waitSummary(p, live) : null;
  const w = p.wait;
  const np = nearest(p, PARKING);
  const own = p.parking && /own|plaza/i.test(p.parking);
  const nw = WCS.length ? nearest(p, WCS) : null;
  const near = PLACES.filter((q) => q !== p && POI(q) && q.status === "open")
    .map((q) => ({ q, d: Math.hypot(q.x - p.x, q.y - p.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 4)
    .map((o) => ({ q: o.q, m: walkM(p, o.q) }));
  const os = openState(p);
  return (
    <>
      <IRow ic="pin" right={<MiniBtn onClick={() => copy(p.address || p.name, "Address copied")}>Copy</MiniBtn>}>
        {p.address || "Address not confirmed"}
        <small>Little Tokyo, Los Angeles</small>
      </IRow>
      {p.cat === "eat" && (
        <IRow ic="hourglass">
          <b>{ws ? ws.t : "Wait time: no reports yet"}</b>
          {ws?.sub && <small>{ws.sub}</small>}
          {(!ws || !ws.live) && w?.basis && (
            <small>
              {w.basis}
              {w.confidence ? ` (${w.confidence === "good" ? "well reported" : w.confidence === "some" ? "some reports" : "few reports"})` : ""}
            </small>
          )}
          {w?.reservations && <small>Reservations: {w.reservations}</small>}
          {w?.sources?.[0] && !ws?.live && (
            <small>
              Source: <A href={w.sources[0]}>{domain(w.sources[0])}</A>
            </small>
          )}
        </IRow>
      )}
      {p.hours ? (
        <IRow ic="clock">
          <span className={cx("font-bold", os.k === "y" && "text-success", os.k === "n" && "text-danger")}>{os.t}</span>
          <MiniTable
            label="Opening hours"
            cols={["Day", "Hours"]}
            rows={[1, 2, 3, 4, 5, 6, 0].map((i) => ({ k: String(i), a: DAYN[DAYS[i]], b: hoursText(p.hours![DAYS[i]]), on: i === d }))}
          />
          {p.hoursSource && <small>Hours from {domain(p.hoursSource)}, checked Nov 2026. Confirm before you go.</small>}
        </IRow>
      ) : (
        <IRow ic="clock">
          {p.hoursNote || "Hours not confirmed yet"}
          <small>Call ahead.</small>
        </IRow>
      )}
      {p.admission && <IRow ic="ticket">{p.admission}</IRow>}
      {p.phone && (
        <IRow ic="phone" right={<MiniBtn onClick={() => copy(p.phone!, "Phone number copied")}>Copy</MiniBtn>}>
          {p.phone}
        </IRow>
      )}
      {p.website && (
        <IRow ic="web">
          <A href={p.website}>{domain(p.website)}</A>
        </IRow>
      )}
      <IRow ic="park" right={np ? <MiniBtn onClick={() => actions.showRouteBetween(np.p, p, "From parking")}>Route</MiniBtn> : undefined}>
        <b>{own ? "Has parking: " + p.parking : p.parking === "street/garage only" ? "No parking of its own" : "Parking not confirmed"}</b>
        {p.parkingNote && <small>{p.parkingNote}</small>}
        {np && <small>Nearest garage or lot: {np.p.name}, {fmtMin(np.m)} walk</small>}
      </IRow>
      <IRow ic="wc" right={nw ? <MiniBtn onClick={() => actions.showRouteBetween(p, nw.p, "To restroom")}>Route</MiniBtn> : undefined}>
        <b>{p.restroom && p.restroom !== "unknown" ? "Restroom: " + (p.restroom === true ? "for customers" : p.restroom) : "Restroom here: not confirmed"}</b>
        {nw && <small>Nearest likely restroom: {nw.p.name}, {fmtMin(nw.m)} walk</small>}
      </IRow>
      {p.cat === "eat" && !noAccount && <OwnerBox p={p} />}
      <h3 className="font-display mt-5 mb-1 text-base font-extrabold tracking-[-0.025em]">Nearby</h3>
      {near.map(({ q, m }) => (
        <ListRow key={q.id} p={q} right={fmtMin(m)} onClick={() => actions.openPlace(q)} />
      ))}
    </>
  );
}

function About({ p }: { p: Place }) {
  return (
    <>
      <p className="mt-3 mb-1 text-[14.5px] leading-relaxed">{p.desc || "Description coming soon."}</p>
      {!!p.knownFor?.length && (
        <div>
          <div className="text-accent mt-3 text-[11px] font-semibold tracking-[0.14em] uppercase">Known for</div>
          <div className="my-2 flex flex-wrap gap-1.5">
            {p.knownFor.map((k) => (
              <Chip key={k} size="md" variant="secondary">
                {k}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {p.since && (
        <IRow ic="store">
          In Little Tokyo since {p.since}
          <small>About {new Date().getFullYear() - p.since} years</small>
        </IRow>
      )}
      {!!p.sources.length && (
        <div className="text-muted mt-3 text-xs">
          Sources:{" "}
          {p.sources.slice(0, 3).map((s, i) => (
            <span key={s}>
              {i ? ", " : ""}
              <a href={s} target="_blank" rel="noopener" className="text-inherit">
                {domain(s)}
              </a>
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function Story({ p }: { p: Place }) {
  return (
    <>
      <div className="bg-gold-soft mt-3 rounded-3xl p-4">
        <h4 className="font-display text-gold m-0 mb-1.5 text-base font-extrabold tracking-[-0.02em]">
          {p.story && p.legacy ? "A Little Tokyo legacy business" : "Their story"}
        </h4>
        <p className="m-0 text-sm leading-relaxed">{p.story || "No story yet."}</p>
        {p.story && p.storySource && (
          <div className="text-muted mt-2 text-[11.5px]">
            Source:{" "}
            <a href={p.storySource} target="_blank" rel="noopener" className="text-inherit">
              {domain(p.storySource)}
            </a>
          </div>
        )}
      </div>
      <div className="bg-surface-secondary text-muted mt-3 rounded-3xl p-4 text-[13.5px]">
        <b className="text-foreground mb-1 block">A note from the owner</b>
        Owner stories coming soon.
      </div>
    </>
  );
}

/** Parking, restrooms and the Metro station: no tabs, just the facts. */
function SimpleInfo({ p }: { p: Place }) {
  return (
    <div className="px-4 pt-1 pb-6">
      {p.address && <IRow ic="pin">{p.address}</IRow>}
      {p.desc && <p className="my-2.5">{p.desc}</p>}
      {p.rateList && p.rateList.length ? (
        <IRow ic="ticket">
          <b>Rates</b>
          <MiniTable label="Parking rates" cols={["Time", "Price"]} rows={p.rateList.map((r) => ({ k: r.label, a: r.label, b: r.price }))} />
          <small>
            {(p.rateSrc ? "From " + domain(p.rateSrc) : "As published") +
              (p.rateDate && p.rateDate !== "undated" ? ", " + p.rateDate : "") +
              (p.rateConf === "third-party listing" ? " (third-party listing)" : "") +
              ". Confirm on site."}
          </small>
        </IRow>
      ) : p.rates ? (
        <IRow ic="ticket">
          {p.rates}
          <small>As published; confirm on site</small>
        </IRow>
      ) : p.cat === "park" ? (
        <IRow ic="ticket">
          <b>Rates not confirmed</b>
          <small>Check the sign at the entrance.</small>
        </IRow>
      ) : null}
      {p.cat === "park" && p.entrance && <IRow ic="pin">Entrance: {p.entrance}</IRow>}
      {p.cat === "park" && p.kind && <IRow ic="park">{p.kind === "garage" ? "Parking garage" : "Surface lot"}</IRow>}
      {p.validation && <IRow ic="ticket">{p.validation}</IRow>}
      {p.hoursText && <IRow ic="clock">{p.hoursText}</IRow>}
      {p.access && (
        <IRow ic="wc">
          Access: {p.access}
          {p.confidence && <small>{p.confidence === "confirmed" ? "Confirmed" : "Likely, not yet confirmed"}</small>}
        </IRow>
      )}
      {p.cat === "metro" && <p className="my-2.5">{METRO_DESC || "Metro A and E Line station at 1st St & Central Ave."}</p>}
      {p.sources[0] && (
        <div className="text-muted text-xs">
          Source:{" "}
          <a href={p.sources[0]} target="_blank" rel="noopener" className="text-inherit">
            {domain(p.sources[0])}
          </a>
        </div>
      )}
    </div>
  );
}

/* ---------------- walking route ---------------- */
export function RouteHead({ big, small }: { big: string; small: string }) {
  return (
    <div className="flex items-baseline gap-2.5 px-4 pt-2 pb-1">
      <b className="font-display text-accent text-[32px] leading-none font-extrabold tracking-[-0.03em]">{big}</b>
      <span className="text-muted text-sm">{small}</span>
    </div>
  );
}

export function RoutePanel({ fromName, to, r, label, onBack }: { fromName: string; to: Place | Me; r: Route; label?: string; onBack: () => void }) {
  const toName = "name" in to ? to.name : "your spot";
  return (
    <>
      <RouteHead big={fmtMin(r.meters)} small={fmtM(r.meters) + " · walking"} />
      <div className="px-4 pt-1 pb-6">
        <div className="text-muted mt-0.5 mb-2 text-xs">
          {(label ? label + ": " : "") + fromName + " → " + toName + ". Walking time at an easy pace, plaza walkways included."}
        </div>
        <ul className="bg-surface-secondary m-0 mt-1.5 list-none rounded-3xl px-3.5 py-1">
          <Step ic="●" text={"Start at " + fromName} />
          {r.steps.map((s, i) => (
            <Step key={i} ic={i ? "↱" : "↑"} text={(i ? "Continue on " : "Head along ") + stepName(s.k)} d={fmtM(s.m)} />
          ))}
          <Step ic="◆" text={"Arrive at " + toName} />
        </ul>
        <div className="mt-3 flex gap-2">
          <MapBtn onClick={onBack}>Back</MapBtn>
        </div>
      </div>
    </>
  );
}
function Step({ ic, text, d }: { ic: string; text: string; d?: string }) {
  return (
    <li className="border-separator grid grid-cols-[26px_1fr_auto] items-center gap-2 border-b py-2.5 text-[13.5px] last:border-b-0">
      <span className="text-accent text-center">{ic}</span>
      <span>{text}</span>
      <span className="text-muted text-xs tabular-nums">{d}</span>
    </li>
  );
}

export function MapBtn({ onClick, children, primary }: { onClick: () => void; children: ReactNode; primary?: boolean }) {
  return (
    <Button fullWidth size="lg" variant={primary ? "primary" : "secondary"} className="flex-1 rounded-full font-semibold" onPress={onClick}>
      {children}
    </Button>
  );
}

/** Two-column HeroUI table (hours, parking rates). */
function MiniTable({ label, cols, rows }: { label: string; cols: [string, string]; rows: { k: string; a: string; b: string; on?: boolean }[] }) {
  return (
    <Table variant="secondary" className="mt-2 rounded-2xl">
      <Table.ScrollContainer>
        <Table.Content aria-label={label} className="text-[13px]">
          <Table.Header>
            <Table.Column isRowHeader>{cols[0]}</Table.Column>
            <Table.Column className="text-right">{cols[1]}</Table.Column>
          </Table.Header>
          <Table.Body>
            {rows.map((r) => (
              <Table.Row key={r.k} id={r.k} className={cx(r.on && "text-accent font-bold")}>
                <Table.Cell className="py-1.5 whitespace-normal">{r.a}</Table.Cell>
                <Table.Cell className="py-1.5 text-right tabular-nums">{r.b}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

/* ---------------- the day plan on the map ---------------- */
export interface PlanState {
  stops: Place[];
  park: Place | null;
  legs: PlanLeg[];
  active: number;
  times: Record<string, string>;
}

export function PlanSheet({
  pv, me, focusLeg, wholeRoute, close, details,
}: { pv: PlanState; me: Me; focusLeg: (i: number) => void; wholeRoute: () => void; close: () => void; details: (p: Place) => void }) {
  const { legs, active, park, stops } = pv;
  const total = legs.reduce((t, l) => t + (l.r ? l.r.meters : 0), 0);
  const legIndexFrom = (p: Place) => legs.findIndex((l) => l.a === p);
  const legFrom = (p: Place) => legs.find((l) => l.a === p);
  const cur = active >= 0 ? legs[active] : null;
  const nameOf = (x: Place | Me) => ("cat" in x ? (x.cat === "park" ? "your car" : x.name) : "your spot");

  const WalkRow = ({ l }: { l: PlanLeg }) => {
    const i = legs.indexOf(l);
    const on = i === active;
    const m = l.r ? l.r.meters : 0;
    return (
      <button type="button" onClick={() => focusLeg(i)} className={cx("text-muted hover:bg-default/60 grid w-full grid-cols-[30px_auto_1fr] items-center gap-2.5 rounded-xl py-0.5 pr-2 text-left text-xs transition-colors", on && "text-foreground")}>
        <span
          className={cx("h-[26px] justify-self-center rounded-full", on ? "bg-accent w-1" : "w-0.5")}
          style={on ? undefined : { background: "repeating-linear-gradient(var(--accent) 0 3px,transparent 3px 7px)" }}
        />
        <span>{`${fmtMin(m)} walk · ${fmtM(m)}`}</span>
        <span className="text-accent truncate text-right text-[12.5px] font-semibold">to {nameOf(l.b)} ›</span>
      </button>
    );
  };
  const StopRow = ({ p, num, sub }: { p: Place; num: string; sub: string }) => {
    const i = legIndexFrom(p);
    const on = active >= 0 && legs[active].a === p;
    return (
      <div className="grid grid-cols-[30px_1fr_auto] items-center gap-2.5 py-2">
        <button type="button" onClick={() => focusLeg(i)} className={cx("size-[30px] rounded-full p-0 text-[12.5px] font-bold text-white shadow-[var(--surface-shadow)]", num === "P" ? "bg-park" : "bg-accent")}>
          {num}
        </button>
        <button type="button" onClick={() => focusLeg(i)} className="flex min-w-0 flex-col bg-transparent p-0 text-left">
          <b className={cx("text-[14.5px] font-semibold", on && "text-accent")}>{p.name}</b>
          <small className="text-muted text-xs">{sub}</small>
        </button>
        <MiniBtn onClick={() => details(p)}>Details</MiniBtn>
      </div>
    );
  };
  const Start = ({ children }: { children: ReactNode }) => (
    <div className="text-muted pt-1.5 pb-0.5 pl-10 text-[11px] font-semibold tracking-[0.12em] uppercase">{children}</div>
  );

  return (
    <>
      <RouteHead
        big={cur && cur.r ? fmtMin(cur.r.meters) : fmtMin(total)}
        small={cur ? "to " + nameOf(cur.b) : "walking in total · " + stops.length + " stops"}
      />
      <div className="px-4 pt-1 pb-6">
        <div className="text-muted mb-1.5 text-xs">
          {cur ? "Walking from " + ("cat" in cur.a ? cur.a.name : "your start") + ". Tap another stop or walk to switch." : "Tap a stop for the walk to the next."}
        </div>
        {legs[0]?.start && (
          <>
            <Start>{me.label === "Metro station" ? "Start at the Metro station" : "Start from your spot"}</Start>
            <WalkRow l={legs[0]} />
          </>
        )}
        {park && (
          <>
            <StopRow p={park} num="P" sub={["Park here", park.ratesShort || "Rates not confirmed"].join(" · ")} />
            {legFrom(park) && <WalkRow l={legFrom(park)!} />}
          </>
        )}
        {stops.map((p, i) => (
          <div key={p.id}>
            <StopRow p={p} num={String(i + 1)} sub={[pv.times[p.id] || "", p.type || CATS[p.cat].label].filter(Boolean).join(" · ")} />
            {legFrom(p) && <WalkRow l={legFrom(p)!} />}
          </div>
        ))}
        {park && <Start>Back to your car at {park.name}</Start>}
        <div className="mt-3 flex gap-2">
          <MapBtn onClick={wholeRoute}>Whole route</MapBtn>
          <MapBtn onClick={close}>Close plan</MapBtn>
        </div>
      </div>
    </>
  );
}
