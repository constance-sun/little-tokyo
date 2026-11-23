import { Button, Chip } from "@heroui/react";
import { EVENTS, IMGS, LEGACY, PLACES, POI } from "@/lib/data";
import { laToday } from "@/lib/hours";
import { cx } from "@/lib/cx";
import { navigate } from "@/state/store";

const today = laToday();
const STATS: [string, string][] = [
  [String(PLACES.filter(POI).length), "places"],
  [String(LEGACY.length), "legacy shops"],
  [String(EVENTS.filter((e) => (e.end || e.start) >= today).length), "events"],
];

/** Cover page: a rounded photo card with a red sun behind it, the logo stamped on its corner, and one big button. */
export default function HomeView() {
  const vert =
    "text-muted absolute top-[96px] flex flex-row-reverse gap-1.5 text-[9.5px] leading-none font-semibold tracking-[0.38em] uppercase [writing-mode:vertical-rl]";
  return (
    <div className="bg-background text-foreground absolute inset-0 flex flex-col items-center overflow-hidden px-6 pt-7 pb-6">
      <div aria-hidden className="font-jp text-accent mb-3 text-xl leading-none font-black tracking-[0.08em] [writing-mode:vertical-rl]">
        東京
      </div>
      <div aria-hidden className={cx(vert, "left-4")}>
        <span>Los Angeles</span>
        <span>California</span>
      </div>
      <div aria-hidden className={cx(vert, "right-4")}>
        <span>Japanese American</span>
        <span>Neighborhood</span>
      </div>

      <div className="relative max-h-[420px] min-h-[240px] w-[74%] flex-1">
        <div aria-hidden className="bg-accent absolute -top-[30px] -right-[34px] z-0 size-[118px] rounded-full" />
        <div
          className="absolute inset-0 z-[1] overflow-hidden rounded-[22px] bg-cover shadow-[var(--overlay-shadow)]"
          style={{ backgroundImage: `url(${IMGS.cover})`, backgroundPosition: "58% center" }}
        />
      </div>

      <div className="relative z-[2] mt-[-60px] mb-4 ml-1 flex items-start gap-2.5 self-start">
        <div
          aria-label="Little Tokyo"
          className="font-logo stamp-in text-accent border-accent bg-background inline-flex origin-bottom-left flex-col rounded-[12px] border-[3px] px-2.5 pt-[3px] pb-[7px] pl-[9px] text-[52px] leading-[0.84] tracking-[-0.045em] lowercase shadow-[var(--surface-shadow)]"
        >
          <span>little–</span>
          <span>tokyo</span>
        </div>
        <div aria-hidden className="font-jp text-accent relative z-[3] mt-0.5 ml-[26px] text-2xl leading-none font-medium tracking-[0.2em] [writing-mode:vertical-rl]">
          リトル東京
        </div>
      </div>

      <h1 className="sr-only">Little Tokyo, Los Angeles</h1>
      <div className="mt-auto flex w-full flex-wrap justify-center gap-1.5">
        {STATS.map(([n, l]) => (
          <Chip key={l} size="sm" variant="secondary">
            <b className="text-foreground">{n}</b> {l}
          </Chip>
        ))}
      </div>
      <Button size="lg" fullWidth className="mt-3 mb-5 h-14 justify-between rounded-full px-6 text-sm font-bold" onPress={() => navigate("map")}>
        Enter Little Tokyo <span className="text-xl">→</span>
      </Button>
    </div>
  );
}
