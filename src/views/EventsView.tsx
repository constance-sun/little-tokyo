import { useMemo, useState } from "react";
import { Alert, Button, Card, Chip, buttonVariants } from "@heroui/react";
import { EmptyNote, Note, PageHeader, Sect } from "@/components/common";
import { ECAT, EVENTS, eventVenue } from "@/lib/data";
import { laToday } from "@/lib/hours";
import { Icon } from "@/lib/icons";
import { cx } from "@/lib/cx";
import { openOnMap } from "@/state/store";
import type { EventItem } from "@/lib/types";

/* ======================================================================
   EVENTS: category pills, a month calendar card with category dots,
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
      className="relative flex h-[176px] flex-col justify-between overflow-hidden rounded-3xl bg-cover bg-center p-3.5 text-left text-white shadow-[var(--surface-shadow)] transition-transform outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] active:scale-[0.98]"
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
        <span className="text-[12px] font-medium opacity-90 [text-shadow:0_1px_6px_rgba(0,0,0,.7)]">{evWhen(e)}</span>
        <b className="font-display text-xl leading-[1.08] font-extrabold tracking-[-0.025em] [text-shadow:0_1px_6px_rgba(0,0,0,.7)]">{e.title}</b>
      </span>
    </button>
  );
}

function EventDetail({ e, onClose }: { e: EventItem; onClose: () => void }) {
  const v = eventVenue(e);
  const ph = e.photo;
  return (
    <div className="bg-background absolute inset-0 z-[25] overflow-y-auto overscroll-contain">
      <div
        className="relative mx-3 mt-3 flex min-h-[260px] flex-col justify-end gap-2 overflow-hidden rounded-[28px] bg-cover bg-center px-4 pt-3.5 pb-5 text-white"
        style={cardBg(e, "rgba(0,0,0,.55) 0%,rgba(0,0,0,.1) 32%,rgba(0,0,0,.25) 55%,rgba(0,0,0,.85) 100%")}
      >
        <Button
          size="sm"
          aria-label="Back to events"
          onPress={onClose}
          className="absolute top-3 left-3 bg-black/45 text-white backdrop-blur-md"
        >
          ‹ Events
        </Button>
        <div className="flex items-center gap-1.5">
          <EvIcon c={e.category} size={22} icon={13} />
          <PhotoChip>{elabel(e.category)}</PhotoChip>
        </div>
        <h2 className="font-display m-0 text-[28px] leading-[1.04] font-extrabold tracking-[-0.03em] [text-shadow:0_2px_14px_rgba(0,0,0,.5)]">{e.title}</h2>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <Card>
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
        {e.description && <p className="text-foreground/85 m-0 text-[14.5px] leading-relaxed">{e.description}</p>}
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
    </div>
  );
}

function Fact({ k, v, icon }: { k: string; v: string; icon: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="bg-accent-soft text-accent grid size-9 shrink-0 place-items-center rounded-xl">
        <Icon name={icon} size={17} />
      </span>
      <div className="min-w-0">
        <small className="text-muted block text-[11.5px] font-medium">{k}</small>
        <b className="text-[14.5px] font-semibold">{v}</b>
      </div>
    </div>
  );
}

export default function EventsView() {
  const today = laToday();
  const [filter, setFilter] = useState("all");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [sel, setSel] = useState(today);
  const [open, setOpen] = useState<EventItem | null>(null);

  const list = useMemo(() => EVENTS.filter((e) => filter === "all" || e.category === filter), [filter]);
  const [Y, Mo] = month.split("-").map(Number);
  const first = new Date(Date.UTC(Y, Mo - 1, 1));
  const days = new Date(Date.UTC(Y, Mo, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const trail = (7 - ((lead + days) % 7)) % 7;
  const shift = (k: number) => setMonth(iso(new Date(Date.UTC(Y, Mo - 1 + k, 1))).slice(0, 7));
  const selEv = list.filter((e) => evOn(e, sel));
  const upcoming = list.filter((e) => (e.end || e.start) >= today).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 14);

  const chips: [string, string][] = [["all", "All"], ...Object.entries(ECAT).map(([k, v]) => [k, v[0]] as [string, string])];

  return (
    <div className="relative h-full">
      <div className="h-full overflow-y-auto overscroll-contain px-4 pt-5 pb-8">
        <PageHeader title="What's on" lede="Festivals, pop-ups, shows." />
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pt-px pb-1">
          {chips.map(([k, l]) => (
            <Button
              key={k}
              size="sm"
              variant={filter === k ? "primary" : "secondary"}
              aria-pressed={filter === k}
              onPress={() => setFilter(k)}
              className="flex-none gap-1.5 rounded-full"
            >
              {k !== "all" && <EvIcon c={k} size={16} icon={10} />}
              {l}
            </Button>
          ))}
        </div>

        <Card className="mt-3 p-3">
          <div className="mb-2 flex items-center justify-between">
            <Button isIconOnly size="sm" variant="tertiary" aria-label="Previous month" onPress={() => shift(-1)}>‹</Button>
            <b className="font-display text-[17px] font-extrabold tracking-[-0.02em]">
              {first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
            </b>
            <Button isIconOnly size="sm" variant="tertiary" aria-label="Next month" onPress={() => shift(1)}>›</Button>
          </div>

          <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] gap-y-1 text-center">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} className="text-muted pb-1 text-[11px] font-semibold">{d}</div>
            ))}
            {Array.from({ length: lead }, (_, i) => <div key={"l" + i} aria-hidden />)}
            {Array.from({ length: days }, (_, i) => {
              const d = i + 1;
              const day = `${month}-${String(d).padStart(2, "0")}`;
              const evs = list.filter((e) => evOn(e, day));
              const cats = [...new Set(evs.map((e) => e.category))];
              const isToday = day === today, isSel = day === sel;
              return (
                <button
                  key={day}
                  type="button"
                  aria-label={`${day}, ${evs.length} events`}
                  aria-pressed={isSel}
                  onClick={() => setSel(day)}
                  className={cx(
                    "mx-auto flex h-[50px] w-full max-w-[46px] flex-col items-center justify-start gap-1 rounded-2xl pt-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]",
                    isSel ? "bg-accent-soft" : "hover:bg-default",
                  )}
                >
                  <span
                    className={cx(
                      "grid size-6 place-items-center rounded-full text-[13px] leading-none font-semibold",
                      isToday ? "bg-accent text-accent-foreground" : isSel ? "text-accent" : evs.length ? "text-foreground" : "text-muted/70",
                    )}
                  >
                    {d}
                  </span>
                  <span className="flex items-center gap-0.5">
                    {cats.slice(0, 2).map((c) => <EvIcon key={c} c={c} size={10} icon={6} />)}
                    {cats.length > 2 && <span className="text-muted text-[8.5px] leading-none">+{cats.length - 2}</span>}
                  </span>
                </button>
              );
            })}
            {Array.from({ length: trail }, (_, i) => <div key={"t" + i} aria-hidden />)}
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
      </div>
      {open && <EventDetail e={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
