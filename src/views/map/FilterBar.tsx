import { Button, Checkbox, Radio, RadioGroup, Separator, Surface } from "@heroui/react";
import { CATS, PLACES, SUBS, isGone } from "@/lib/data";
import { Icon } from "@/lib/icons";
import { cx } from "@/lib/cx";
import { useApp } from "@/state/store";
import type { Cat } from "@/lib/types";
import { waitOK } from "./engine";

export const CHIPS: [string, string, string | null][] = [
  ["eat", "Eat", "dining"], ["shop", "Shop", "shop"], ["explore", "Explore", "temple"], ["legacy", "Legacy", "star"],
  ["open", "Open now", null], ["park", "Parking", "park"], ["wc", "Restrooms", "wc"], ["closed", "Closed / moved", null],
];
export const WAITOPTS: [string, string][] = [["any", "Any wait"], ["10", "Under 10 min"], ["30", "Under 30 min"], ["60", "Under 1 hour"]];

/** Floating pill look shared by the chips and the filter button (they sit on the map, so they need a surface + shadow). */
const floatPill = "h-8 shrink-0 rounded-full px-3 text-sm font-semibold shadow-[var(--surface-shadow)]";

/** Single-choice filter chips. There is no "All" chip: tapping the active chip again goes back to showing everything.
 *  `front`: chip keys to pull up first (iteration 4 leads with Parking and Restrooms). */
export function Chips({ filter, onPick, front = [] }: { filter: string; onPick: (k: string) => void; front?: string[] }) {
  const chips = front.length
    ? [...front.map((k) => CHIPS.find((c) => c[0] === k)!), ...CHIPS.filter((c) => !front.includes(c[0]))]
    : CHIPS;
  return (
    <div className="no-scrollbar -mx-2.5 flex gap-1.5 overflow-x-auto px-2.5 pt-px pb-1.5">
      {chips.map(([k, l, ic]) => {
        const on = filter === k;
        const gold = on && k === "legacy";
        return (
          <Button
            key={k}
            size="sm"
            variant={on ? "primary" : "tertiary"}
            aria-pressed={on}
            className={cx(floatPill, !on && "bg-surface text-foreground", gold && "bg-gold text-white")}
            onPress={() => onPick(k)}
          >
            {ic && <Icon name={ic} size={14} stroke={on ? "currentColor" : (CATS as Record<string, { color: string }>)[k]?.color || "currentColor"} />}
            {l}
          </Button>
        );
      })}
    </div>
  );
}

/** One "Filter" button for the chosen category: wait time (Eat only) and types, with counts. */
export function TypeFilter({
  filter, subs, waitF, open, setOpen, setSubs, setWaitF,
}: {
  filter: Cat;
  subs: Set<string>;
  waitF: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  setSubs: (s: Set<string>) => void;
  setWaitF: (w: string) => void;
}) {
  const live = useApp((s) => s.live);
  const types = SUBS[filter]!;
  const counts = Object.fromEntries(types.map(([k]) => [k, PLACES.filter((p) => p.cat === filter && p.sub === k && !isGone(p)).length]));
  const label = [
    subs.size ? [...subs].map((k) => (types.find((t) => t[0] === k) || [k, k])[1]).join(", ") : waitF === "any" ? "All types" : null,
    waitF !== "any" ? (WAITOPTS.find((o) => o[0] === waitF) || ["", ""])[1] : null,
  ].filter(Boolean).join(" · ");
  const inCat = PLACES.filter((p) => p.cat === filter && !isGone(p) && (!subs.size || subs.has(p.sub || "")));
  const waitN = Object.fromEntries(WAITOPTS.map(([k]) => [k, inCat.filter((p) => waitOK(p, k, live)).length]));
  const hasWait = filter === "eat";
  const active = subs.size > 0 || waitF !== "any";
  const sectLbl = "text-muted px-1 text-xs font-semibold tracking-[0.12em] uppercase";
  const row = "w-full rounded-xl px-1 py-1.5";
  const line = "flex w-full items-center gap-2.5 text-sm";
  return (
    <div className="relative flex items-center gap-1.5">
      <Button
        size="sm"
        variant="tertiary"
        aria-expanded={open}
        onPress={() => setOpen(!open)}
        className={cx(floatPill, "bg-surface max-w-[78%]", active ? "text-foreground shadow-[inset_0_0_0_1.5px_var(--foreground),var(--surface-shadow)]" : "text-foreground")}
      >
        <Icon name="filter" size={14} />
        <span className="truncate">{label}</span>
        <span className="text-muted text-[10px]">{open ? "▴" : "▾"}</span>
      </Button>
      {active && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 rounded-full bg-surface/80 px-3 text-sm font-semibold text-foreground"
          onPress={() => {
            setSubs(new Set());
            setWaitF("any");
          }}
        >
          Clear
        </Button>
      )}
      {open && (
        <Surface
          variant="default"
          className="absolute top-10 left-0 z-[15] flex max-h-[min(70vh,520px)] w-[264px] flex-col gap-1 overflow-y-auto rounded-[24px] p-3 shadow-[var(--overlay-shadow)]"
        >
          {hasWait && (
            <>
              <div className={sectLbl}>Wait time</div>
              <RadioGroup aria-label="Wait time" variant="secondary" value={waitF} onChange={setWaitF} className="gap-0">
                {WAITOPTS.map(([k, l]) => {
                  const none = k !== "any" && !waitN[k];
                  return (
                    <Radio key={k} value={k} isDisabled={none && waitF !== k} className={cx(row, "mt-0!", none && "opacity-45")}>
                      <Radio.Content className={line}>
                        <Radio.Control>
                          <Radio.Indicator />
                        </Radio.Control>
                        <span className="bg-default text-foreground grid size-6 flex-none place-items-center rounded-full">
                          <Icon name="hourglass" size={12} />
                        </span>
                        <span className="flex-1">{l}</span>
                        <span className="text-muted text-xs tabular-nums">{k === "any" ? "" : waitN[k]}</span>
                      </Radio.Content>
                    </Radio>
                  );
                })}
              </RadioGroup>
              <div className="text-muted px-1 pb-1 text-xs">Busy-time waits, from reviews and owners.</div>
              <Separator className="my-1.5" />
            </>
          )}
          <div className={sectLbl}>{CATS[filter].label} types</div>
          {types
            .filter(([k]) => counts[k])
            .map(([k, l, ic]) => (
              <Checkbox
                key={k}
                variant="secondary"
                isSelected={subs.has(k)}
                onChange={(c) => {
                  const n = new Set(subs);
                  if (c) n.add(k);
                  else n.delete(k);
                  setSubs(n);
                }}
                className={row}
              >
                <Checkbox.Content className={line}>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <span className="grid size-6 flex-none place-items-center rounded-full" style={{ background: CATS[filter].color }}>
                    <Icon name={ic} size={12} stroke="#fff" />
                  </span>
                  <span className="flex-1">{l}</span>
                  <span className="text-muted text-xs tabular-nums">{counts[k]}</span>
                </Checkbox.Content>
              </Checkbox>
            ))}
          <Button fullWidth size="md" className="mt-2 rounded-full font-semibold" onPress={() => setOpen(false)}>
            Done
          </Button>
        </Surface>
      )}
    </div>
  );
}
