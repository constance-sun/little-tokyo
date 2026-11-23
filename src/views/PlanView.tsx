import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Button, Card, Chip, Input, Label, Spinner, Switch, TextArea, TextField, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { CatDot, LegacyChip, ListRow, Note, Page, PageHeader, PlaceThumb, Tile } from "@/components/common";
import { BY } from "@/lib/data";
import { browserDictation, getHost, type Dictation } from "@/lib/claude";
import { fmtMin, prefersReducedMotion } from "@/lib/format";
import { laToday } from "@/lib/hours";
import { Icon } from "@/lib/icons";
import { SURVEY_DEF, quickPlan, replyTo } from "@/lib/planner";
import { walkM } from "@/lib/route";
import { waitSummary } from "@/lib/waits";
import { cx } from "@/lib/cx";
import { PlaceDetailPage } from "./PlaceDetailPage";
import { PlanMapPage, PlanPreview } from "./PlanMap";
import {
  addAvoid, getState, openOnMap, planKey, savePlan, setChat, setPlan, setSurvey, showPlanOnMap, toast, useApp, useFeature, type Survey,
} from "@/state/store";
import type { ChatMsg, Place, Plan, Pt } from "@/lib/types";

/* ======================================================================
   Voice + chat state lives at module level so dictation callbacks (wired once)
   and the async planner reply keep working across re-renders.
   ====================================================================== */
interface Voice {
  dict: Dictation | null;
  ready: boolean;
  micOn: boolean;
  partial: string;
  holdMode: boolean;
  holdTap: boolean;
  holdBuf: string;
  holdTitle: string | null;
  busy: boolean;
  draft: string;
}
let V: Voice = { dict: null, ready: false, micOn: false, partial: "", holdMode: false, holdTap: false, holdBuf: "", holdTitle: null, busy: false, draft: "" };
const vsubs = new Set<() => void>();
const setV = (p: Partial<Voice>) => {
  V = { ...V, ...p };
  vsubs.forEach((f) => f());
};
const useVoice = () => useSyncExternalStore((f) => (vsubs.add(f), () => vsubs.delete(f)), () => V);

let dictLoading: Promise<void> | null = null;
function loadDictation() {
  dictLoading ??= (async () => {
    const d = (await getHost<Dictation>("dictation")) || browserDictation();
    if (d) {
      d.onPartial(({ text }) => setV({ partial: text }));
      d.onFinal(({ text }) => {
        if (V.holdMode) setV({ holdBuf: (V.holdBuf + " " + text).trim(), partial: "" });
        else setV({ draft: (V.draft ? V.draft.trimEnd() + " " : "") + text.trim(), partial: "" });
      });
      d.onState(({ state }) => setV({ micOn: state !== "idle" }));
    }
    setV({ dict: d, ready: true });
  })();
  return dictLoading;
}

const scrollToResult = () =>
  setTimeout(() => document.getElementById("planResult")?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" }), 60);

async function send(text0?: string, opts: { fromVoice?: boolean } = {}) {
  const text = (text0 ?? V.draft).trim();
  if (!text || V.busy) return;
  if (V.micOn && V.dict && !opts.fromVoice) {
    try { await V.dict.stop(); } catch { /* ignore */ }
  }
  setChat([...getState().chat, { role: "user", text: opts.fromVoice ? text.replace(/^Plan my day from scratch: /, "🎙 ") : text }]);
  setV({ busy: true, ...(text0 == null ? { draft: "" } : {}) });
  try {
    const reply = await replyTo(text);
    setChat([...getState().chat, reply]);
  } finally {
    setV({ busy: false });
    scrollToResult();
  }
}

async function endHold() {
  if (!V.holdMode) return;
  setV({ holdTap: false, holdTitle: "Got it, planning…" });
  try { await V.dict?.stop(); } catch { /* ignore */ }
  setTimeout(() => {
    const said = (V.holdBuf + " " + V.partial).trim();
    setV({ holdMode: false, partial: "", holdTitle: null });
    if (said) void send("Plan my day from scratch: " + said, { fromVoice: true });
    else toast("Didn't catch that. Try again.");
  }, 350);
}

async function toggleMic() {
  const d = V.dict;
  if (!d) { toast("Voice works in Chrome and Safari."); return; }
  if (V.micOn) { try { await d.stop(); } catch { /* ignore */ } return; }
  setV({ holdMode: false });
  d.start().catch((e: { code?: string }) => { if (e && e.code === "not_granted") toast("Mic is blocked. Type instead."); });
}

/* ======================================================================
   Hold to talk
   ====================================================================== */
function HoldCard() {
  const v = useVoice();
  const t0 = useRef(0);
  const on = v.holdMode;

  const startHold = (e: PointerEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>, tap = false) => {
    e.preventDefault();
    if (!V.dict) { toast("Voice works in Chrome and Safari."); return; }
    if (V.holdMode && V.holdTap) { void endHold(); return; }
    if ("pointerId" in e && e.pointerId != null) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    t0.current = Date.now();
    setV({ holdMode: true, holdTap: tap, holdBuf: "", partial: "", holdTitle: null });
    V.dict.start().catch((err: { code?: string }) => {
      setV({ holdMode: false, holdTap: false });
      toast(err && err.code === "not_granted" ? "Mic is blocked. Allow it in settings." : "Mic didn't start. Try again.");
    });
  };
  const release = () => {
    if (!V.holdMode || V.holdTap) return;
    if (Date.now() - t0.current < 450) { setV({ holdTap: true }); return; } // a quick tap: keep listening until tapped again
    void endHold();
  };

  const title = v.holdTitle || (on ? (v.holdTap ? "Listening… tap again when done" : "Listening… let go to plan") : "Hold to talk");
  const sub = on
    ? (v.holdBuf + " " + v.partial).trim() || "Who's coming, what you like, how long you've got."
    : v.dict || !v.ready ? "Tap to start, tap to stop." : "Voice works in Chrome and Safari.";

  return (
    <Card className={cx("mb-3 select-none", on && "bg-accent-soft")}>
      <Card.Content className="flex flex-row items-center gap-4">
        {/* A plain button: hold-to-talk needs raw pointer down/up, which HeroUI's press events don't expose. Styled as a HeroUI primary icon button. */}
        <button
          type="button"
          aria-label="Hold to talk"
          className={cx(
            "bg-accent text-accent-foreground grid size-[60px] flex-none touch-none place-items-center rounded-full shadow-[var(--surface-shadow)] transition-[box-shadow,transform] outline-none select-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 active:scale-95 [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]",
            on && "pulse-soft shadow-[0_0_0_10px_color-mix(in_oklab,var(--accent)_22%,transparent)]",
          )}
          onPointerDown={(e) => startHold(e)}
          onPointerUp={release}
          onPointerCancel={release}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if ((e.key === " " || e.key === "Enter") && !e.repeat) {
              e.preventDefault();
              if (V.holdMode) void endHold();
              else startHold(e, true);
            }
          }}
        >
          <Icon name="mic" size={26} />
        </button>
        <div className="flex min-w-0 flex-col gap-0.5">
          <b className="font-display text-foreground text-base font-extrabold tracking-[-0.02em]">{title}</b>
          <span className="text-muted text-sm">{sub}</span>
        </div>
      </Card.Content>
    </Card>
  );
}

/* ======================================================================
   Survey
   ====================================================================== */
const Q = ({ children }: { children: ReactNode }) => (
  <div className="font-display text-foreground mt-1 text-base font-extrabold tracking-[-0.02em]">{children}</div>
);

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <Switch isSelected={checked} onChange={onChange} className="mt-1">
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <span className="text-foreground text-sm">{children}</span>
      </Switch.Content>
    </Switch>
  );
}

const STEPS = ["When", "Interests", "Details", "Getting here"];

function SurveyCard() {
  const SV = useApp((s) => s.survey);
  const today = laToday();
  const go = (p: Partial<Survey>) => setSurvey(p);
  const navRow = (back: boolean, next: () => void, nextLabel = "Next") => (
    <div className="mt-1 flex gap-2">
      {back && (
        <Button variant="secondary" className="flex-1" size="lg" onPress={() => go({ step: SV.step - 1 })}>
          Back
        </Button>
      )}
      <Button className="flex-1" size="lg" onPress={next}>
        {nextLabel}
      </Button>
    </div>
  );

  return (
    <Card>
      <Card.Content className="flex flex-col gap-3.5">
        {/* step indicator: four segments, tappable */}
        <div className="grid grid-cols-4 gap-1.5" role="tablist" aria-label="Survey steps">
          {STEPS.map((l, i) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={SV.step === i}
              onClick={() => go({ step: i })}
              className="group flex flex-col items-start gap-1.5 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
            >
              <span className={cx("h-1.5 w-full rounded-full transition-colors", SV.step >= i ? "bg-accent" : "bg-default", SV.step > i && "opacity-45")} />
              <span className={cx("text-xs font-semibold", SV.step === i ? "text-foreground" : "text-muted")}>
                <span className="tabular-nums">{i + 1}</span> · {l}
              </span>
            </button>
          ))}
        </div>

        {SV.step === 0 && (
          <>
            <Q>When are you going?</Q>
            <div className="flex gap-2">
              <TextField className="min-w-0 flex-1" defaultValue={SV.date || today} onChange={(v) => go({ date: v })}>
                <Label>Date</Label>
                <Input type="date" min={today} className="text-sm" />
              </TextField>
              <TextField className="min-w-0 flex-1" defaultValue={SV.start} onChange={(v) => go({ start: v })}>
                <Label>Start time</Label>
                <Input type="time" className="text-sm" />
              </TextField>
            </div>
            <Q>For how long?</Q>
            <ToggleButtonGroup
              fullWidth
              selectionMode="single"
              disallowEmptySelection
              aria-label="How long"
              selectedKeys={[SV.dur]}
              onSelectionChange={(k) => {
                const d = [...k][0] as Survey["dur"] | undefined;
                if (d) go({ dur: d });
              }}
            >
              <ToggleButton id="short">2 hours</ToggleButton>
              <ToggleButton id="half">Half day</ToggleButton>
              <ToggleButton id="full">Full day</ToggleButton>
            </ToggleButtonGroup>
            {navRow(false, () => go({ date: SV.date || today, step: 1 }))}
          </>
        )}

        {SV.step === 1 && (
          <>
            <Q>What are you into?</Q>
            <Note className="-mt-2">Pick as many as you like.</Note>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(SURVEY_DEF).map(([k, g]) => (
                <Tile
                  key={k}
                  big
                  on={SV.groups.includes(k)}
                  label={g.label}
                  icon={g.icon}
                  onClick={() => go({ groups: SV.groups.includes(k) ? SV.groups.filter((x) => x !== k) : [...SV.groups, k] })}
                />
              ))}
            </div>
            {navRow(true, () => {
              if (!SV.groups.length) { toast("Pick at least one"); return; }
              go({ step: 2 });
            })}
          </>
        )}

        {SV.step === 2 && (
          <>
            {SV.groups.map((k) => {
              const g = SURVEY_DEF[k];
              const cur = SV.picks[k] || [];
              return (
                <div key={k} className="flex flex-col gap-2.5">
                  <Q>{k === "food" ? "What kind of food?" : k === "shop" ? "What kind of shopping?" : "What kind of experiences?"}</Q>
                  <div className="flex flex-wrap gap-1.5">
                    {g.opts.map(([o, l]) => (
                      <ToggleButton
                        key={o}
                        size="sm"
                        isSelected={cur.includes(o)}
                        onChange={(sel) => go({ picks: { ...SV.picks, [k]: sel ? [...cur, o] : cur.filter((x) => x !== o) } })}
                        className="rounded-full data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                      >
                        {l}
                      </ToggleButton>
                    ))}
                  </div>
                </div>
              );
            })}
            <Toggle checked={SV.legacy} onChange={(v) => go({ legacy: v })}>Include legacy businesses</Toggle>
            {navRow(true, () => go({ step: 3 }))}
          </>
        )}

        {SV.step === 3 && (
          <>
            <Q>How are you getting here?</Q>
            <div className="grid grid-cols-2 gap-2">
              <Tile on={SV.travel === "drive"} label="Driving" icon="park" onClick={() => go({ travel: "drive" })} />
              <Tile on={SV.travel === "metro"} label="Metro" icon="metro" onClick={() => go({ travel: "metro" })} />
              <Tile on={SV.travel === "walk"} label="Walk or rideshare" icon="people" onClick={() => go({ travel: "walk" })} />
              <Tile on={SV.travel === "skip"} label="Skip: I'm sorted" icon="dir" onClick={() => go({ travel: "skip" })} />
            </div>
            {SV.travel === "drive" && (
              <>
                <Q>Do you need parking?</Q>
                <ToggleButtonGroup
                  fullWidth
                  selectionMode="single"
                  disallowEmptySelection
                  aria-label="Parking preference"
                  selectedKeys={[SV.parkPref]}
                  onSelectionChange={(k) => {
                    const v = [...k][0] as Survey["parkPref"] | undefined;
                    if (v) go({ parkPref: v });
                  }}
                >
                  <ToggleButton id="cheap">Cheapest</ToggleButton>
                  <ToggleButton id="close">Closest to my stops</ToggleButton>
                </ToggleButtonGroup>
                <Toggle checked={SV.parkInPlan} onChange={(v) => go({ parkInPlan: v })}>Start and end my plan at the parking</Toggle>
              </>
            )}
            {navRow(true, () => {
              const plan = quickPlan(true);
              setPlan(plan);
              setChat([...getState().chat, { role: "assistant", text: "Here's your day. 👎 a stop to swap it.", plan }]);
              go({ step: 0 });
              scrollToResult();
            }, "Build my day")}
          </>
        )}
      </Card.Content>
    </Card>
  );
}

/* ======================================================================
   The plan: a vertical timeline
   ====================================================================== */
/** Timeline marker: the stop's category icon on its colour (parking shows the parking icon). */
const StopDot = ({ p }: { p: Place }) => <CatDot p={p} size={24} icon={13} className="relative z-[1] ring-4 ring-[var(--surface)]" />;
/** One row of the timeline: the marker column (with the line running through) and the body. */
function Row({ marker, children, last }: { marker: ReactNode; children: ReactNode; last?: boolean }) {
  return (
    <div className="relative grid grid-cols-[24px_1fr] gap-3 pb-1">
      {!last && <span aria-hidden className="bg-separator absolute top-6 bottom-0 left-[11px] w-0.5" />}
      <div className="pt-0.5">{marker}</div>
      <div className="min-w-0 pb-2">{children}</div>
    </div>
  );
}
const Walk = ({ m }: { m: number }) => (
  <div className="relative grid grid-cols-[24px_1fr] gap-3">
    <span aria-hidden className="absolute inset-y-0 left-[11px] w-0.5 border-l-2 border-dashed border-[var(--separator)]" />
    <span />
    <div className="text-muted flex items-center gap-1 py-1 text-xs">
      <Icon name="people" size={12} /> {fmtMin(m)} walk
    </div>
  </div>
);

/** `onDetails` (chat Guide): Details opens a full-page overlay instead of the map, and there's no 👍/👎. */
function PlanCard({ plan, onDetails, onMap }: { plan: Plan; onDetails?: (p: Place) => void; onMap?: () => void }) {
  const me = useApp((s) => s.me);
  const live = useApp((s) => s.live);
  const plans = useApp((s) => s.acct.plans);
  const noAccount = useFeature("noAccount");
  const stops = plan.stops.filter((s) => BY[s.id]);
  const park = plan.park ? BY[plan.park] : undefined;
  let prev: Pt = park || me;
  let tot = 0;
  const saved = plans.some((x) => x.title === plan.title && planKey(x) === planKey(plan));

  return (
    <Card className="mt-3">
      <Card.Header className="flex-row items-baseline justify-between gap-2">
        <Card.Title className="font-display text-xl font-extrabold tracking-[-0.02em]">{plan.title || "Your day"}</Card.Title>
        {plan.date && (
          <Chip size="sm" variant="soft" color="accent">
            {new Date(plan.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </Chip>
        )}
      </Card.Header>
      <Card.Content className="gap-0">
        {park && (
          <Row marker={<StopDot p={park} />}>
            <div className="text-muted text-xs">Park first</div>
            <b className="text-sm">{park.name}</b>
            <p className="text-muted m-0 mt-0.5 text-sm">{park.ratesShort || park.rates || "Rates not confirmed"}</p>
          </Row>
        )}
        {stops.map((s, j) => {
          const p = BY[s.id];
          const wm = walkM(prev, p);
          tot += wm;
          prev = p;
          const ws = p.cat === "eat" ? waitSummary(p, live) : null;
          return (
            <div key={s.id + j}>
              <Walk m={wm} />
              <Row marker={<StopDot p={p} />} last={!park && j === stops.length - 1}>
                {/* chat Guide: photo first, text kept short */}
                {onDetails && (
                  <button type="button" onClick={() => onDetails(p)} aria-label={`${p.name} details`} className="mb-2 block w-full p-0">
                    <PlaceThumb p={p} icon={40} className="h-[150px] w-full rounded-[18px]" />
                  </button>
                )}
                <div className="text-muted text-xs font-medium">{[s.time, s.minutes ? s.minutes + " min" : null].filter(Boolean).join(" · ")}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <b className="text-sm">{p.name}</b>
                  {p.legacy && <LegacyChip />}
                </div>
                {s.why && <p className={cx("m-0 mt-1 text-sm", onDetails && "text-muted line-clamp-2")}>{s.why}</p>}
                {ws && <Note className="mt-0.5">⏱ {ws.t}</Note>}
                <div className="mt-2 flex items-center gap-1.5">
                  {!onDetails && (<>
                  <Button isIconOnly size="sm" variant="tertiary" aria-label="Keep" onPress={() => void send(`Keep ${p.name}, I like it.`)}>
                    👍
                  </Button>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="tertiary"
                    aria-label="Swap"
                    onPress={() => {
                      addAvoid(p.id);
                      void send(`I don't want ${p.name}. Swap it for something else.`);
                    }}
                  >
                    👎
                  </Button>
                  </>)}
                  <Button size="sm" variant={onDetails ? "secondary" : "ghost"} className={cx(onDetails && "-ml-0.5")} onPress={() => (onDetails ? onDetails(p) : openOnMap(p.id))}>
                    Details
                  </Button>
                </div>
              </Row>
            </div>
          );
        })}
        {park && (() => {
          const wm = walkM(prev, park);
          tot += wm;
          return (
            <>
              <Walk m={wm} />
              <Row marker={<StopDot p={park} />} last>
                <div className="text-muted text-xs">Back to your car</div>
                <b className="text-sm">{park.name}</b>
              </Row>
            </>
          );
        })()}
        <Note className="mt-1">About {fmtMin(tot)} of walking in total.</Note>
        {plan.tip && <div className="bg-accent-soft text-accent-soft-foreground mt-3 rounded-xl px-3 py-2 text-sm">{plan.tip}</div>}
        {onMap && <PlanPreview plan={{ ...plan, stops }} onExpand={onMap} />}
      </Card.Content>
      {!onMap && <Card.Footer className="gap-2">
        <Button className="flex-1" size="lg" onPress={() => showPlanOnMap({ ...plan, stops })}>
          <Icon name="pin" size={16} /> See on map
        </Button>
        {!noAccount && (
          <Button variant="secondary" className="flex-1" size="lg" onPress={() => void savePlan(plan)}>
            {saved ? "Saved ✓" : "Save plan"}
          </Button>
        )}
      </Card.Footer>}
    </Card>
  );
}

/* ======================================================================
   Tweak it: chat
   ====================================================================== */
function Bubble({ m, curPlan }: { m: ChatMsg; curPlan: Plan | null }) {
  if (m.role === "user")
    return <div className="bg-accent text-accent-foreground max-w-[85%] self-end rounded-[18px] px-3.5 py-2 text-sm leading-[1.45]">{m.text}</div>;
  return (
    <div className="bg-surface-secondary text-foreground max-w-[85%] self-start rounded-[18px] px-3.5 py-2 text-sm leading-[1.45]">
      {m.text && <div>{m.text}</div>}
      {m.plan && m.plan.stops && m.plan.stops.length > 0 && m.plan !== curPlan && <Note>Plan updated above.</Note>}
    </div>
  );
}

function ChatCard() {
  const chat = useApp((s) => s.chat);
  const curPlan = useApp((s) => s.plan);
  const v = useVoice();
  const logRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [chat.length, v.busy]);
  useEffect(() => {
    const t = taRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = Math.min(110, t.scrollHeight) + "px";
  }, [v.draft]);
  const listening = v.micOn && !v.holdMode;

  return (
    <Card className="mt-3">
      <Card.Header className="flex-row items-center justify-between gap-2">
        <Card.Title className="font-display text-xl font-extrabold tracking-[-0.02em]">Tweak it</Card.Title>
        {chat.length > 0 && (
          <Button size="sm" variant="ghost" onPress={() => setChat([])}>
            Clear chat
          </Button>
        )}
      </Card.Header>
      <Card.Content className="gap-3">
        <div ref={logRef} className="flex max-h-[460px] flex-col gap-2 overflow-y-auto overscroll-contain p-0.5">
          {!chat.length && <Bubble m={{ role: "assistant", text: 'Try "ramen instead of sushi" or "done by 3."' }} curPlan={curPlan} />}
          {chat.map((m, i) => <Bubble key={i} m={m} curPlan={curPlan} />)}
          {v.busy && (
            <div className="bg-surface-secondary text-muted flex items-center gap-2 self-start rounded-[18px] px-3.5 py-2 text-sm">
              <Spinner size="sm" color="accent" /> Thinking…
            </div>
          )}
        </div>
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {["Less walking", "Swap lunch", "Add a museum", "Cheaper", "End by 4pm"].map((s) => (
            <Button key={s} size="sm" variant="secondary" className="flex-none rounded-full" onPress={() => void send(s)}>
              {s}
            </Button>
          ))}
        </div>
        {v.partial && !v.holdMode && <div className="text-muted px-1.5 text-sm italic">{v.partial}</div>}
        <div className="flex items-end gap-2">
          <Button
            isIconOnly
            variant={listening ? "primary" : "tertiary"}
            aria-label={v.micOn ? "Stop listening" : "Talk"}
            onPress={() => void toggleMic()}
            className={cx("size-[42px] flex-none rounded-full", listening && "pulse-soft")}
          >
            <Icon name="mic" size={20} />
          </Button>
          <TextArea
            ref={taRef}
            rows={1}
            id="chatIn"
            aria-label="Ask for changes"
            placeholder={listening ? "Listening…" : "Ask for changes"}
            enterKeyHint="send"
            value={v.draft}
            onChange={(e) => setV({ draft: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            className="max-h-[110px] min-h-[42px] flex-1 resize-none rounded-[21px] px-3.5 py-2.5 text-sm leading-[1.3]"
          />
          <Button isIconOnly aria-label="Send" onPress={() => void send()} className="size-[42px] flex-none rounded-full">
            <Icon name="dir" size={18} />
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}

/* ======================================================================
   Iteration 5+ (chatGuide): the whole page is one AI chat. The itinerary is
   built and edited in the conversation; the latest plan shows as a card in it.
   ====================================================================== */
const STARTERS = [
  "Half a day of ramen and shopping",
  "A quick taste, I'm coming by Metro",
  "A full day with museums and temples",
  "Driving in, and I want cheap parking",
];
const TWEAKS = ["Less walking", "Swap lunch", "Add a museum", "Cheaper", "End by 4pm"];

/** Suggestions (not a plan): a short list of places; tap one for the full details page. */
function PicksCard({ ids, onOpen }: { ids: string[]; onOpen: (p: Place) => void }) {
  const me = useApp((s) => s.me);
  return (
    <Card className="mt-2 gap-0 px-4 py-2">
      {ids.map((id) => BY[id]).filter(Boolean).map((p) => (
        <ListRow key={p.id} p={p} right={fmtMin(walkM(me, p)) + " walk"} onClick={() => onOpen(p)} />
      ))}
    </Card>
  );
}

function ChatGuide() {
  const [detail, setDetail] = useState<Place | null>(null);
  const closeDetail = useCallback(() => setDetail(null), []);
  const [mapOpen, setMapOpen] = useState(false);
  const chat = useApp((s) => s.chat);
  const plan = useApp((s) => s.plan);
  const v = useVoice();
  const logRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    // after a reply, bring your own last message to the top so the answer (and plan) read from the start
    const mine = el.querySelectorAll<HTMLElement>("[data-mine]");
    const last = mine[mine.length - 1];
    const top = !v.busy && last && chat[chat.length - 1]?.role === "assistant" ? last.offsetTop - 12 : el.scrollHeight;
    el.scrollTo({ top, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [chat, v.busy]);
  useEffect(() => {
    const t = taRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = Math.min(110, t.scrollHeight) + "px";
  }, [v.draft]);
  const listening = v.micOn && !v.holdMode;
  // the newest assistant message carrying a plan gets the full card; older plans are a one-line note
  let lastPlanAt = -1;
  chat.forEach((m, i) => { if (m.role === "assistant" && m.plan?.stops?.length) lastPlanAt = i; });
  const hasPlan = !!(plan && plan.stops?.length);

  return (
    <div className="bg-background relative flex h-full flex-col">
      {detail && <PlaceDetailPage place={detail} onClose={closeDetail} />}
      {mapOpen && plan && <PlanMapPage plan={plan} onClose={() => setMapOpen(false)} />}
      <div ref={logRef} className="relative flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-3">
        {!chat.length ? (
          <div className="flex min-h-full flex-col justify-center gap-5 pb-6">
            <div>
              <h1 className="font-display m-0 text-3xl leading-[1.05] font-extrabold tracking-[-0.03em]">Plan your day</h1>
              <p className="text-muted mt-2 mb-0 max-w-[34ch] text-sm">
                Tell me what you're into and how long you have. I'll put together a walking plan, and we can change it as we go.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2">
              {STARTERS.map((s) => (
                <Button key={s} variant="secondary" className="h-auto min-h-10 rounded-[18px] py-2 text-left whitespace-normal" onPress={() => void send(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {chat.map((m, i) =>
              m.role === "user" ? (
                <div key={i} data-mine className="bg-accent text-accent-foreground max-w-[85%] self-end rounded-[18px] px-3.5 py-2 text-sm leading-[1.45]">{m.text}</div>
              ) : (
                <div key={i} className="flex flex-col self-stretch">
                  {m.text && <div className="bg-surface-secondary text-foreground max-w-[85%] self-start rounded-[18px] px-3.5 py-2 text-sm leading-[1.45]">{m.text}</div>}
                  {m.picks && m.picks.some((id) => BY[id]) && <PicksCard ids={m.picks} onOpen={setDetail} />}
                  {i === lastPlanAt && hasPlan ? (
                    <PlanCard plan={plan!} onDetails={setDetail} onMap={() => setMapOpen(true)} />
                  ) : m.plan?.stops?.length ? (
                    <Note className="mt-1 px-1.5">Earlier version: {m.plan.title || "your day"}, {m.plan.stops.length} stops.</Note>
                  ) : null}
                </div>
              ),
            )}
            {v.busy && (
              <div className="bg-surface-secondary text-muted flex items-center gap-2 self-start rounded-[18px] px-3.5 py-2 text-sm">
                <Spinner size="sm" color="accent" /> Thinking…
              </div>
            )}
          </div>
        )}
      </div>
      <div className="border-separator bg-background flex flex-col gap-2 border-t px-3 pt-2 pb-[max(10px,env(safe-area-inset-bottom))]">
        {hasPlan && (
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {TWEAKS.map((s) => (
              <Button key={s} size="sm" variant="secondary" className="flex-none rounded-full" isDisabled={v.busy} onPress={() => void send(s)}>
                {s}
              </Button>
            ))}
          </div>
        )}
        {v.partial && !v.holdMode && <div className="text-muted px-1.5 text-sm italic">{v.partial}</div>}
        <div className="flex items-end gap-2">
          <Button
            isIconOnly
            variant={listening ? "primary" : "secondary"}
            aria-label={v.micOn ? "Stop listening" : "Talk"}
            onPress={() => void toggleMic()}
            className={cx("size-10 flex-none rounded-full", listening && "pulse-soft")}
          >
            <Icon name="mic" size={20} />
          </Button>
          {/* the field: text box with a small send button inside it on the right */}
          <div className="bg-field focus-within:ring-foreground/20 flex min-h-10 flex-1 items-end rounded-[20px] shadow-[var(--field-shadow,0_0_0_1px_var(--border))] focus-within:ring-2">
            <TextArea
              ref={taRef}
              rows={1}
              id="chatIn"
              aria-label="Message the guide"
              placeholder={listening ? "Listening…" : hasPlan ? "Ask for changes" : "What sounds good today?"}
              enterKeyHint="send"
              value={v.draft}
              onChange={(e) => setV({ draft: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              className="max-h-[110px] min-h-10 flex-1 resize-none border-0 bg-transparent py-[10px] pr-1 pl-4 text-sm leading-[1.4] shadow-none ring-0 outline-none focus:ring-0 focus-visible:ring-0"
            />
            <Button
              isIconOnly
              size="sm"
              aria-label="Send"
              isDisabled={v.busy || !v.draft.trim()}
              onPress={() => void send()}
              className="m-1 size-8 min-w-8 flex-none rounded-full"
            >
              <Icon name="send" size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlanView() {
  const plan = useApp((s) => s.plan);
  const chatGuide = useFeature("chatGuide");
  useEffect(() => {
    void loadDictation();
  }, []);
  if (chatGuide) return <ChatGuide />;
  return (
    <Page>
      <PageHeader title="Plan your day" lede="Four questions. Or just say it." />
      <HoldCard />
      <SurveyCard />
      <div id="planResult" className="scroll-mt-2">
        {plan && plan.stops && plan.stops.length > 0 && <PlanCard plan={plan} />}
      </div>
      <ChatCard />
    </Page>
  );
}
