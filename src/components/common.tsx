import type { ReactNode } from "react";
import { Card, Chip } from "@heroui/react";
import { Icon } from "@/lib/icons";
import { CATS } from "@/lib/data";
import { liveWait } from "@/lib/waits";
import { useApp } from "@/state/store";
import { cx } from "@/lib/cx";
import type { Place } from "@/lib/types";

/* Shared building blocks for every view, on HeroUI v3.
   Design language: soft rounded surfaces on a light-grey background, pill chips,
   the Little Tokyo red as the HeroUI accent, Gen Interface JP type. */

/** A place's line icon on its category colour, as a round dot. */
export function CatDot({ p, size = 28, icon = 15, className }: { p: Place; size?: number; icon?: number; className?: string }) {
  return (
    <span
      className={cx("inline-grid shrink-0 place-items-center rounded-full", className)}
      style={{ width: size, height: size, background: CATS[p.cat].color }}
    >
      <Icon name={p.glyph} size={icon} stroke="#fff" />
    </span>
  );
}

/** A place's first photo, cropped to fill; places without one get their category colour and icon. Size it with className. */
export function PlaceThumb({ p, className, icon = 22 }: { p: Place; className?: string; icon?: number }) {
  const ph = p.photos[0];
  return (
    <span className={cx("grid shrink-0 place-items-center overflow-hidden", className)} style={ph ? undefined : { background: CATS[p.cat].color }}>
      {ph ? <img src={ph.src} alt="" loading="lazy" className="size-full object-cover" /> : <Icon name={p.glyph} size={icon} stroke="#fff" />}
    </span>
  );
}

/** Page wrapper: a scroll container with the standard padding. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="bg-background h-full overflow-y-auto overscroll-contain">
      <div className={cx("px-4 pt-5 pb-8", className)}>{children}</div>
    </div>
  );
}

/** Page title block used at the top of Events, Plan, Legacy and Account. */
export function PageHeader({ title, lede, eyebrow, children }: { title: string; lede?: string; eyebrow?: string; children?: ReactNode }) {
  return (
    <header className="relative mb-4">
      {eyebrow && <div className="text-accent mb-1 text-xs font-semibold tracking-[0.18em] uppercase">{eyebrow}</div>}
      <h1 className="font-display m-0 text-3xl leading-[1.05] font-extrabold tracking-[-0.03em]">{title}</h1>
      {lede && <p className="text-muted mt-1.5 mb-0 max-w-[36ch] text-sm">{lede}</p>}
      {children}
    </header>
  );
}

/** Section heading inside a page. */
export function Sect({ children, className, action }: { children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <div className={cx("mt-7 mb-2.5 flex items-baseline justify-between gap-2", className)}>
      <h2 className="font-display m-0 text-xl font-extrabold tracking-[-0.02em]">{children}</h2>
      {action}
    </div>
  );
}

/** Small uppercase label in the accent colour. */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("text-accent text-xs font-semibold tracking-[0.14em] uppercase", className)}>{children}</div>;
}

export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("text-muted text-xs", className)}>{children}</div>;
}

/** A gentle empty state inside a card. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <Card variant="secondary" className="mt-2.5">
      <Card.Content className="text-muted text-sm">{children}</Card.Content>
    </Card>
  );
}

/** Legacy badge (gold chip). */
export function LegacyChip({ since, className }: { since?: number | null; className?: string }) {
  return (
    <Chip size="sm" variant="soft" className={cx("bg-gold-soft text-gold", className)}>
      ★ Legacy{since ? ` · since ${since}` : ""}
    </Chip>
  );
}

/** A tappable place row: thumbnail, name, type, and a pill on the right. */
export function ListRow({ p, right, onClick }: { p: Place; right: string; onClick: () => void }) {
  const live = useApp((s) => s.live);
  const ph = p.photos[0];
  const lw = p.cat === "eat" ? liveWait(p, live) : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-default/60 -mx-2 grid w-[calc(100%+16px)] grid-cols-[48px_1fr_auto] items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors"
    >
      <span className="grid size-12 place-items-center overflow-hidden rounded-[12px]" style={ph ? undefined : { background: CATS[p.cat].color }}>
        {ph ? <img src={ph.src} alt="" className="size-full object-cover" /> : <Icon name={p.glyph} size={20} stroke="#fff" />}
      </span>
      <span className="min-w-0">
        <b className="block truncate text-sm font-semibold">{p.name}</b>
        <small className="text-muted block truncate text-sm">
          {[p.type || CATS[p.cat].label, p.legacy ? "★ Legacy" : null, lw ? `~${lw.minutes} min wait` : null].filter(Boolean).join(" · ")}
        </small>
      </span>
      <Chip size="sm" variant="soft" color="accent">
        {right}
      </Chip>
    </button>
  );
}

/** Big choice tile used by the plan survey and account (a pressable card). */
export function Tile({
  on, label, icon, onClick, big, className,
}: { on: boolean; label: string; icon?: string; onClick: () => void; big?: boolean; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        "bg-surface-secondary text-foreground flex min-h-[56px] flex-col items-center justify-center gap-1.5 rounded-[20px] px-2 py-3 text-center text-sm font-semibold transition-[background,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]",
        big && "min-h-[96px] text-sm font-bold",
        on ? "bg-accent-soft text-accent-soft-foreground shadow-[inset_0_0_0_2px_var(--accent)]" : "hover:bg-default",
        className,
      )}
    >
      {icon && (
        <span className={cx("leading-none", on ? "text-accent" : "text-muted")}>
          <Icon name={icon} size={22} />
        </span>
      )}
      <span>{label}</span>
    </button>
  );
}

/** The boxed red "little– / tokyo" wordmark. */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      aria-label="Little Tokyo"
      className={cx(
        "font-logo text-accent border-accent inline-flex flex-col items-start rounded-[6px] border-2 px-[7px] pt-0.5 pb-1 pl-1.5 text-sm leading-[0.86] tracking-[-0.045em] lowercase",
        className,
      )}
    >
      <span>little–</span>
      <span>tokyo</span>
    </span>
  );
}
