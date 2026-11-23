import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Chip, buttonVariants } from "@heroui/react";
import { EmptyNote, Note, PageHeader, Sect } from "@/components/common";
import { ECAT, EVENTS, eventVenue } from "@/lib/data";
import { laToday } from "@/lib/hours";
import { Icon } from "@/lib/icons";
import { cx } from "@/lib/cx";
import { openOnMap } from "@/state/store";
import type { EventItem } from "@/lib/types";

/* ======================================================================
   EVENTS: category pills, a week strip (scrolls sideways a week at a time) with category dots,
   photo cards for the chosen day and what's coming up, and a detail overlay.
   ====================================================================== */

const ecol = (c: string) => (ECAT[c] ? ECAT[c][2] : "#777");
const eicon = (c: string) => (ECAT[c] ? ECAT[c][1] : "star");
const elabel = (c: string) => (ECAT[c] ? ECAT[c][0] : c);

const iso = (d: Date) => d.toISOString().slice(0, 10);
const pd = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const evOn = (e: EventItem, day: string) => day >= e.start && day <= (e.end || e.start);
const fmtDay = (s: string, o: Intl.DateTimeFormatOptions) => pd(s).toLocaleDateString("en-US", { timeZone: "UTC", ...o });
function evWhen(e: EventItem) {
  const span = e.end && e.end !== e.start;
  return (
    (span
      ? fmtDay(e.start, { month: "short", day: "numeric" }) + " – " + fmtDay(e.end!, { month: "short", day: "numeric" })
      : fmtDay(e.start, { weekday: "short", month: "short", day: "numeric" })) + (e.time ? " · " + e.time.replace(/(\d{1,2}):00/g, "$1") : "")
  );
}
const unconfirmed = (e: EventItem) => !!e.date_status && e.date_status !== "confirmed";

/** Round category icon. */
function EvIcon({ c, size = 18, icon = 12 }: { c: string; size?: number; icon?: number }) {
  return (
    <span className="inline-grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size, background: ecol(c) }}>
      <Icon name={eicon(c)} size={icon} stroke="#fff" />
    </span>
  );
}

const shade = "rgba(0,0,0,.55) 0%,rgba(0,0,0,.1) 35%,rgba(0,0,0,.2) 55%,rgba(0,0,0,.85) 100%";
function cardBg(e: EventItem, grad = shade) {
  return e.photo?.src
    ? { backgroundImage: `linear-gradient(180deg,${grad}),url(${e.photo.src})` }
    : { background: `linear-gradient(150deg,${ecol(e.category)},#120f0c)` };
}

/** A chip that reads on top of a photo. */
const PhotoChip = ({ children }: { children: React.ReactNode }) => (
  <Chip size="sm" className="bg-black/45 text-white backdrop-blur-md">
    {children}
  </Chip>
);

function EvCard({ e, onOpen }: { e: EventItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative flex h-[176px] flex-col justify-between overflow-hidden rounded-[24px] bg-cover bg-center p-3.5 text-left text-white shadow-[var(--surface-shadow)] transition-transform outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] active:scale-[0.98]"
      style={cardBg(e)}
    >
      <span className="z-[1] flex items-center gap-1.5">
        <EvIcon c={e.category} size={22} icon={13} />
        <PhotoChip>{elabel(e.category)}</PhotoChip>
        {unconfirmed(e) && (
          <Chip size="sm" color="warning" variant="primary" className="ml-auto">
            Date to confirm
          </Chip>
        )}
      </span>
      {!e.photo?.src && (
        <span className="absolute top-[30px] right-3 leading-none">
          <Icon name={eicon(e.category)} size={64} stroke="rgba(255,255,255,.28)" />
        </span>
      )}
      <span className="z-[1] flex flex-col gap-1">
        <span className="text-xs font-medium opacity-90 [text-shadow:0_1px_6px_rgba(0,0,0,.7)]">{evWhen(e)}</span>
        <b className="font-display text-xl leading-[1.08] font-extrabold tracking-[-0.025em] [text-shadow:0_1px_6px_rgba(0,0,0,.7)]">{e.title}</b>
      </span>
    </button>
  );
}

function EventDetail({ e, onClose }: { e: EventItem; onClose: () => void }) {
  return (
    <div className="bg-background absolute inset-0 z-[25] overflow-y-auto overscroll-contain">
      <EventDetailBody e={e} onClose={onClose} />
    </div>
  );
}

/** Event detail content: hero, facts, description, actions. Used full-screen and in the map's sheet. */
export function EventDetailBody({ e, onClose, backLabel = "‹ Events" }: { e: EventItem; onClose: () => void; backLabel?: string }) {
  const v = eventVenue(e);
  const ph = e.photo;
  return (
    <>
      <div
        className="relative mx-3 mt-3 flex min-h-[260px] flex-col justify-end gap-2 overflow-hidden rounded-[24px] bg-cover bg-center px-4 pt-3.5 pb-5 text-white"
        style={cardBg(e, "rgba(0,0,0,.55) 0%,rgba(0,0,0,.1) 32%,rgba(0,0,0,.25) 55%,rgba(0,0,0,.85) 100%")}
      >
        <Button
          size="sm"
          aria-label="Back to events"
          onPress={onClose}
          className="absolute top-3 left-3 bg-black/45 text-white backdrop-blur-md"
        >
          {backLabel}
        </Button>
        <div className="flex items-center gap-1.5">
          <EvIcon c={e.category} size={22} icon={13} />
          <PhotoChip>{elabel(e.category)}</PhotoChip>
        </div>
        <h2 className="font-display m-0 text-3xl leading-[1.04] font-extrabold tracking-[-0.03em] [text-shadow:0_2px_14px_rgba(0,0,0,.5)]">{e.title}</h2>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <Card className="rounded-[24px]">
          <Card.Content className="grid gap-3">
            <Fact icon="clock" k="When" v={evWhen(e)} />
            {e.venue && <Fact icon="pin" k="Where" v={e.venue} />}
            {e.price && <Fact icon="ticket" k="Price" v={e.price} />}
          </Card.Content>
        </Card>
        {unconfirmed(e) && (
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Date to confirm</Alert.Title>
              <Alert.Description>Usual timing. Confirm with the organizer.</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
        {e.description && <p className="text-foreground/85 m-0 text-sm leading-relaxed">{e.description}</p>}
        {e.recurring && <Note>Repeats: {e.recurring}</Note>}
        <div className="flex gap-2">
          {v && (
            <Button fullWidth className="flex-1" onPress={() => { onClose(); openOnMap(v.id); }}>
              Show on map
            </Button>
          )}
          {e.url && (
            <a href={e.url} target="_blank" rel="noopener" className={cx(buttonVariants({ variant: "secondary", fullWidth: true }), "flex-1")}>
              Organizer page ↗
            </a>
          )}
        </div>
        {ph?.src && (
          <Note>
            {(ph.venue ? "Photo of the venue: " : "Photo: ") + (ph.author || "") + " · "}
            <a href={ph.source} target="_blank" rel="noopener" className="underline">{ph.license || "license"}</a>
          </Note>
        )}
      </div>
    </>
  );
}

function Fact({ k, v, icon }: { k: string; v: string; icon: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="bg-accent-soft text-accent grid size-9 shrink-0 place-items-center rounded-xl">
        <Icon name={icon} size={17} />
      </span>
      <div className="min-w-0">
        <small className="text-muted block text-xs font-medium">{k}</small>
        <b className="text-sm font-semibold">{v}</b>
      </div>
    </div>
  );
}

/** Sunday-to-Saturday weeks from this week through the week of the last event (at least 8 weeks). */
function weekRange(today: string): string[][] {
  const t = pd(today);
  const start = new Date(t.getTime() - t.getUTCDay() * 864e5);
  const last = EVENTS.reduce((m, e) => ((e.end || e.start) > m ? e.end || e.start : m), today);
  const n = Math.max(8, Math.ceil((pd(last).getTime() - start.getTime()) / (7 * 864e5)) + 1);
  return Array.from({ length: n }, (_, w) => Array.from({ length: 7 }, (_, d) => iso(new Date(start.getTime() + (w * 7 + d) * 864e5))));
}

/** "November 2026", or "Nov – Dec 2026" / "Dec 2026 – Jan 2027" when a week spans two months. */
function weekLabel(w: string[]) {
  const a = pd(w[0]), b = pd(w[6]);
  const o = { timeZone: "UTC" } as const;
  if (a.getUTCMonth() === b.getUTCMonth()) return a.toLocaleDateString("en-US", { ...o, month: "long", year: "numeric" });
  if (a.getUTCFullYear() === b.getUTCFullYear())
    return `${a.toLocaleDateString("en-US", { ...o, month: "short" })} – ${b.toLocaleDateString("en-US", { ...o, month: "short", year: "numeric" })}`;
  return `${a.toLocaleDateString("en-US", { ...o, month: "short", year: "numeric" })} – ${b.toLocaleDateString("en-US", { ...o, month: "short", year: "numeric" })}`;
}

export default function EventsView() {
  const [open, setOpen] = useState<EventItem | null>(null);
  return (
    <div className="relative h-full">
      <div className="h-full overflow-y-auto overscroll-contain px-4 pt-5 pb-8">
        <EventsBody onOpen={setOpen} />
      </div>
      {open && <EventDetail e={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** The events page content (title, category pills, calendar, day + coming-up lists).
 *  `compact` is the map-sheet version: a smaller title with a count, sized for a peeking sheet. */
export function EventsBody({ onOpen, compact }: { onOpen: (e: EventItem) => void; compact?: boolean }) {
  const today = laToday();
  const [filter, setFilter] = useState("all");
  const [sel, setSel] = useState(today);
  const setOpen = onOpen;

  const list = useMemo(() => EVENTS.filter((e) => filter === "all" || e.category === filter), [filter]);
  const weeks = useMemo(() => weekRange(today), [today]);
  const [wk, setWk] = useState(0);
  const wkRef = useRef(0);
  const strip = useRef<HTMLDivElement>(null);
  const onScroll = () => {
    const el = strip.current;
    if (!el || !el.clientWidth) return;
    wkRef.current = Math.max(0, Math.min(weeks.length - 1, Math.round(el.scrollLeft / el.clientWidth)));
    setWk(wkRef.current);
  };
  const goWeek = (k: number) => {
    const el = strip.current;
    if (!el) return;
    const i = Math.max(0, Math.min(weeks.length - 1, k));
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: i * el.clientWidth, behavior: smooth ? "smooth" : "auto" });
  };
  // Keep the visible week pinned when the strip is resized (e.g. the map sheet changes width).
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === w) return;
      w = el.clientWidth;
      el.scrollLeft = wkRef.current * w;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const selEv = list.filter((e) => evOn(e, sel));
  const upcoming = list.filter((e) => (e.end || e.start) >= today).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 14);

  // no "All" chip: tapping the active chip again goes back to everything (same as the map chips)
  const chips: [string, string][] = Object.entries(ECAT).map(([k, v]) => [k, v[0]] as [string, string]);

  const soon = EVENTS.filter((e) => (e.end || e.start) >= today && e.start <= iso(new Date(pd(today).getTime() + 6 * 864e5))).length;
  return (
    <>
        {compact ? (
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="font-display m-0 text-2xl leading-tight font-extrabold tracking-[-0.03em]">What's on</h2>
            <span className="text-muted text-sm">{soon ? `${soon} event${soon > 1 ? "s" : ""} this week` : "Festivals, pop-ups, shows"}</span>
          </div>
        ) : (
          <PageHeader title="What's on" lede="Festivals, pop-ups, shows." />
        )}
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pt-px pb-1">
          {chips.map(([k, l]) => (
            <Button
              key={k}
              size="sm"
              variant={filter === k ? "primary" : "secondary"}
              aria-pressed={filter === k}
              onPress={() => setFilter(filter === k ? "all" : k)}
              className={cx("flex-none gap-1.5 rounded-full", filter !== k && "text-foreground")}
            >
              <Icon name={eicon(k)} size={16} stroke={filter === k ? "currentColor" : ecol(k)} />
              {l}
            </Button>
          ))}
        </div>

        <Card className="mt-3 rounded-[24px] p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <Button isIconOnly size="sm" variant="tertiary" aria-label="Previous week" isDisabled={wk === 0} onPress={() => goWeek(wk - 1)}>‹</Button>
            <b className="font-display text-base font-extrabold tracking-[-0.02em]" aria-live="polite">{weekLabel(weeks[wk])}</b>
            <Button isIconOnly size="sm" variant="tertiary" aria-label="Next week" isDisabled={wk === weeks.length - 1} onPress={() => goWeek(wk + 1)}>›</Button>
          </div>

          <div ref={strip} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
            {weeks.map((w) => (
              <div key={w[0]} className="grid w-full flex-none snap-start snap-always grid-cols-[repeat(7,minmax(0,1fr))] gap-1">
                {w.map((day) => {
                  const evs = list.filter((e) => evOn(e, day));
                  const cats = [...new Set(evs.map((e) => e.category))];
                  const isToday = day === today, isSel = day === sel, past = day < today;
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-label={`${fmtDay(day, { weekday: "long", month: "long", day: "numeric" })}, ${evs.length} events`}
                      aria-pressed={isSel}
                      onClick={() => setSel(day)}
                      className={cx(
                        "flex h-[72px] w-full flex-col items-center justify-start gap-1 rounded-[14px] pt-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-inset",
                        isSel ? "bg-accent-soft" : "hover:bg-default",
                      )}
                    >
                      <span className={cx("text-xs leading-none font-semibold", isSel ? "text-accent" : "text-muted")}>
                        {fmtDay(day, { weekday: "narrow" })}
                      </span>
                      <span
                        className={cx(
                          "grid size-7 place-items-center rounded-full text-sm leading-none font-semibold",
                          isToday ? "bg-accent text-accent-foreground" : isSel ? "text-accent" : evs.length && !past ? "text-foreground" : "text-muted/70",
                        )}
                      >
                        {pd(day).getUTCDate()}
                      </span>
                      <span className="flex h-2.5 items-center gap-0.5">
                        {cats.slice(0, 2).map((c) => <EvIcon key={c} c={c} size={10} icon={6} />)}
                        {cats.length > 2 && <span className="text-muted text-[8.5px] leading-none">+{cats.length - 2}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>

        <Sect action={selEv.length ? <Chip size="sm" variant="soft" color="accent">{selEv.length}</Chip> : undefined}>
          {fmtDay(sel, { weekday: "long", month: "long", day: "numeric" })}
        </Sect>
        {selEv.length ? (
          <div className="flex flex-col gap-3">{selEv.map((e, i) => <EvCard key={e.title + i} e={e} onOpen={() => setOpen(e)} />)}</div>
        ) : (
          <EmptyNote>Nothing on. Pick a day with a dot.</EmptyNote>
        )}

        <Sect>Coming up</Sect>
        {upcoming.length ? (
          <div className="flex flex-col gap-3">{upcoming.map((e, i) => <EvCard key={e.title + i} e={e} onOpen={() => setOpen(e)} />)}</div>
        ) : (
          <EmptyNote>Event listings are being gathered.</EmptyNote>
        )}
        <Note className="mt-4">"Date to confirm" means the usual timing; the organizer hasn't announced this year's date yet.</Note>
    </>
  );
}
