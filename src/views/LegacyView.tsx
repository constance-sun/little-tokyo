import type { ReactNode } from "react";
import { Button, Card, Chip } from "@heroui/react";
import { EmptyNote, KioskTag, Note } from "@/components/common";
import { LEGACY } from "@/lib/data";
import { Icon } from "@/lib/icons";
import { cx } from "@/lib/cx";
import { openOnMap, useFeature } from "@/state/store";
import type { Place } from "@/lib/types";

/* ======================================================================
   LEGACY: stat cards, the oldest shop as a featured card, a sticky decade
   jump bar, a timeline of rounded rows by decade, then long-time favorites.
   ====================================================================== */

const ERA_NOTES: Record<number, string> = {
  1900: "Little Tokyo grows into the center of Japanese American life in Los Angeles.",
  1940: "After WWII incarceration (1942–45), families come back and start over.",
  1970: "Redevelopment years. Japanese Village Plaza opens in 1978.",
};

function Thumb({ p, className, icon }: { p: Place; className: string; icon: number }) {
  const ph = p.photos[0];
  return (
    <span className={cx("grid place-items-center overflow-hidden", className)} style={ph ? undefined : { background: `var(--c-${p.cat},#777)` }}>
      {ph ? <img src={ph.src} alt={p.name} loading="lazy" className="block size-full object-cover" /> : <Icon name={p.glyph} size={icon} stroke="#fff" />}
    </span>
  );
}

const go = (p: Place) => () => openOnMap(p.id);
const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
const pressable = "outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] transition-[background,transform] active:scale-[0.99]";

export default function LegacyView() {
  const yr = new Date().getFullYear();
  const kiosk = useFeature("kiosk");
  const dated = LEGACY.filter((p) => p.since).sort((a, b) => a.since! - b.since!);
  const undated = LEGACY.filter((p) => !p.since).sort((a, b) => a.name.localeCompare(b.name));
  const first = dated[0];
  const pre60 = dated.filter((p) => p.since! < 1960).length;
  const decades = [...new Set(dated.map((p) => Math.floor(p.since! / 10) * 10))];
  const fph = first?.photos[0];

  return (
    <div className="h-full overflow-y-auto overscroll-contain px-4 pt-[calc(1.25rem+var(--bar,0px))] pb-8">
      {!LEGACY.length ? (
        <EmptyNote>Legacy business list is loading.</EmptyNote>
      ) : (
        <>
          <header className="relative">
            <span aria-hidden className="font-jp text-accent pointer-events-none absolute top-0 right-0 text-5xl leading-none font-black tracking-[-0.02em] opacity-90">
              老舗
            </span>
            {kiosk ? <KioskTag className="bg-foreground text-background">★ Legacy businesses</KioskTag> : <Chip size="sm" variant="soft" className="bg-gold-soft text-gold">★ Legacy businesses</Chip>}
            <h1 className="font-display mt-2 mr-[70px] mb-2 text-4xl leading-[0.98] font-extrabold tracking-[-0.045em]">Still here.</h1>
            <p className="text-muted m-0 mr-16 text-sm">Family-run shops and restaurants that have kept Little Tokyo going for generations.</p>
          </header>

          <div className="mt-5 mb-4 grid grid-cols-3 gap-2">
            <Stat n={String(LEGACY.length)} label="legacy businesses" />
            {first && <Stat n={String(first.since)} label={"oldest, " + first.name} />}
            <Stat n={String(pre60)} label="opened before 1960" />
          </div>

          {first && (
            <Card className="mb-4 overflow-hidden p-0">
              <button type="button" onClick={go(first)} className={cx("relative block w-full text-left", pressable)}>
                <span
                  className="block h-[220px] bg-cover bg-center"
                  style={fph ? { backgroundImage: `url(${fph.src})` } : { background: `var(--c-${first.cat})` }}
                />
                <span className="absolute top-[150px] left-3.5 text-7xl text-[var(--pop)] leading-none font-black tracking-[-0.06em] [text-shadow:0_2px_0_var(--surface)]">
                  {first.since}
                </span>
                <span className="block px-4 pt-9 pb-4">
                  <Chip size="sm" variant="soft" color="accent">The oldest · {yr - first.since!} years</Chip>
                  <b className="font-display mt-2 mb-1.5 block text-2xl leading-tight font-extrabold tracking-[-0.025em]">{first.name}</b>
                  {first.story && <span className="text-foreground/80 line-clamp-3 text-sm leading-[1.5]">{first.story}</span>}
                  <span className="text-foreground mt-3 inline-block text-sm font-semibold">See on the map →</span>
                </span>
              </button>
            </Card>
          )}

          <div className="no-scrollbar bg-background/90 lt-stick sticky top-0 z-[3] -mx-4 mb-1 flex gap-1.5 overflow-x-auto px-4 py-2.5 backdrop-blur-md">
            {decades.map((d) => (
              <JumpBtn key={d} onPress={() => scrollTo("dec" + d)}>{d}s</JumpBtn>
            ))}
            {undated.length > 0 && <JumpBtn onPress={() => scrollTo("decfav")}>Favorites</JumpBtn>}
          </div>

          <div className="before:bg-accent/30 relative pl-6 before:absolute before:top-3 before:bottom-3 before:left-[7px] before:w-0.5 before:rounded-full">
            {decades.map((d) => (
              <div key={d}>
                <div id={"dec" + d} className="relative scroll-mt-[calc(4rem+var(--bar,0px))] pt-5 pb-2">
                  <span className="bg-accent ring-background absolute top-[26px] -left-6 size-4 rounded-full ring-4" />
                  <b className="font-display text-3xl leading-none font-black tracking-[-0.045em]">{d}s</b>
                  {ERA_NOTES[d] && <p className="text-muted mt-1.5 mb-0 text-sm leading-[1.45]">{ERA_NOTES[d]}</p>}
                </div>
                <div className="flex flex-col gap-2">
                  {dated
                    .filter((p) => Math.floor(p.since! / 10) * 10 === d)
                    .map((p) => {
                      const closed = p.status === "closed_permanently";
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={go(p)}
                          className={cx(
                            "bg-surface hover:bg-surface-secondary relative grid w-full grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-2xl p-2.5 text-left shadow-[var(--surface-shadow)]",
                            pressable,
                          )}
                        >
                          <span className="bg-background border-accent absolute top-6 -left-[23px] size-3 rounded-full border-2" />
                          <Thumb p={p} icon={28} className={cx("size-[72px] rounded-[14px]", closed && "opacity-70 grayscale")} />
                          <span className="min-w-0 py-0.5">
                            <span className="flex items-center gap-1.5">
                              <Chip size="sm" variant="soft" color="accent" className="font-bold">{p.since}</Chip>
                              {closed ? (
                                <Chip size="sm" variant="soft" color="danger">Closed</Chip>
                              ) : (
                                <span className="text-muted text-xs font-medium">{yr - p.since!} yrs</span>
                              )}
                            </span>
                            <b className="mt-1 block truncate text-sm font-bold tracking-[-0.015em]">{p.name}</b>
                            <small className="text-muted block truncate text-xs">{p.type || ""}</small>
                            {p.story && <span className="text-foreground/75 mt-1 line-clamp-2 text-sm leading-[1.4]">{p.story}</span>}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>

          {undated.length > 0 && (
            <>
              <div id="decfav" className="relative mt-7 scroll-mt-16 pb-1.5">
                <b className="font-display text-2xl leading-none font-black tracking-[-0.04em]">Long-time favorites</b>
                <p className="text-muted mt-1.5 mb-0 text-sm leading-[1.45]">Legacy-listed, opening year still being confirmed.</p>
              </div>
              <div className="no-scrollbar -mx-4 mt-2.5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
                {undated.map((p) => (
                  <button key={p.id} type="button" onClick={go(p)} className={cx("flex-[0_0_140px] snap-start rounded-[22px] text-left", pressable)}>
                    <Thumb p={p} icon={44} className="mb-2 h-[150px] w-[140px] rounded-[22px] shadow-[var(--surface-shadow)]" />
                    <b className="block text-sm leading-[1.2] font-bold tracking-[-0.015em]">{p.name}</b>
                    <small className="text-muted mt-0.5 block text-xs">{p.type || ""}</small>
                  </button>
                ))}
              </div>
            </>
          )}
          <Note className="mt-5">Legacy status from the Little Tokyo Historical Society and Little Tokyo Service Center lists.</Note>
        </>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <Card variant="secondary" className="gap-1 rounded-[22px] p-3">
      <b className="text-accent block text-2xl leading-none font-black tracking-[-0.04em]">{n}</b>
      <small className="text-muted line-clamp-2 block text-xs leading-[1.3]">{label}</small>
    </Card>
  );
}

function JumpBtn({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  return (
    <Button size="sm" variant="secondary" onPress={onPress} className="flex-none rounded-full font-semibold">
      {children}
    </Button>
  );
}
