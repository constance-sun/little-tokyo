import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button, Card, Label, ListBox, Select, Slider, Tabs, Toast } from "@heroui/react";
import { UNSAFE_PortalProvider } from "react-aria";
import { Logo } from "@/components/common";
import { Icon } from "@/lib/icons";
import { SITE_URL } from "@/lib/data";
import { cx } from "@/lib/cx";
import { ITERATIONS } from "@/lib/iterations";
import { navigate, newChat, PIN_SPACE_DEFAULT, setIteration, setPinSpace, setState, setTheme, useApp, useFeature, VIEWS, type View } from "@/state/store";
import { useHostBootstrap } from "@/state/host";
import HomeView from "@/views/HomeView";
import MapView from "@/views/map/MapView";
import EventsView from "@/views/EventsView";
import PlanView from "@/views/PlanView";
import LegacyView from "@/views/LegacyView";
import AccountView from "@/views/AccountView";

const MENU: [View, string][] = [["map", "Map"], ["events", "Events"], ["plan", "Plan a day"], ["legacy", "Legacy"]];

/** Real phones get the site full screen; computers see it inside a phone frame beside a short note. */
function usePhone() {
  const q = () =>
    matchMedia("(max-width:700px)").matches ||
    (matchMedia("(pointer:coarse)").matches && Math.min(screen.width, screen.height) < 700);
  const [phone, setPhone] = useState(q);
  useEffect(() => {
    const on = () => setPhone(q());
    addEventListener("resize", on);
    return () => removeEventListener("resize", on);
  }, []);
  return phone;
}

function useHashRouter() {
  useEffect(() => {
    // Always open on the front page: drop any hash from the first load.
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    const on = () => {
      const v = location.hash.slice(1) as View;
      setState({ view: VIEWS.includes(v) ? v : "home" });
    };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
}

function Clock() {
  const fmt = () =>
    new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }).replace(/ [AP]M/, "");
  const [t, setT] = useState(fmt);
  useEffect(() => {
    const i = setInterval(() => setT(fmt()), 30000);
    return () => clearInterval(i);
  }, []);
  return <span>{t}</span>;
}

function SiteHeader({ view }: { view: View }) {
  const dark = useApp((s) => s.dark);
  const evSheet = useFeature("eventsSheet");
  const noAccount = useFeature("noAccount");
  const menu = evSheet ? MENU.filter(([v]) => v !== "events") : MENU;
  const menuKey = menu.some(([v]) => v === view) ? view : "";
  return (
    <header className="bg-background relative z-30 flex-none">
      <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-1">
        <a href="#home" className="mr-auto flex items-center no-underline" aria-label="Little Tokyo home">
          <Logo />
        </a>
        {!noAccount && (
          <>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          onPress={() => setTheme(dark ? "light" : "dark")}
        >
          <Icon name={dark ? "moon" : "sun"} size={17} />
        </Button>
        <Button
          isIconOnly
          size="sm"
          variant={view === "account" ? "primary" : "ghost"}
          aria-label="Account"
          onPress={() => navigate("account")}
        >
          <Icon name="user" size={17} />
        </Button>
          </>
        )}
      </div>
      <Tabs
        variant="secondary"
        selectedKey={menuKey}
        onSelectionChange={(k) => navigate(k as View)}
        className="w-full px-2"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Site menu" className="w-full">
            {menu.map(([v, label]) => (
              <Tabs.Tab key={v} id={v} className="flex-1 text-sm font-semibold whitespace-nowrap">
                {label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
    </header>
  );
}

/** Iteration 4+ header (Figma "App bar"): the emblem on the left, a ghost menu icon button on the right (an ✕ while open). */
function MenuBar({ open, onToggle, view }: { open: boolean; onToggle: () => void; view: View }) {
  // the chat Guide's "New chat" lives in the bar so it stays put while the chat scrolls
  const chatGuide = useFeature("chatGuide");
  const hasChat = useApp((s) => s.chat.length > 0);
  return (
    <header className="bg-background relative z-30 flex h-[60px] flex-none items-center justify-between px-4">
      <a href="#home" className="flex items-center" aria-label="Little Tokyo home">
        <img src="/images/emblem.png" alt="" width={45} height={44} className="size-11 object-contain" />
      </a>
      <div className="flex items-center gap-1">
      {chatGuide && view === "plan" && hasChat && !open && (
        <Button size="sm" variant="secondary" onPress={newChat}>
          <Icon name="compose" size={16} /> New chat
        </Button>
      )}
      <Button
        isIconOnly
        variant="ghost"
        size="lg"
        aria-label={open ? "Close menu" : "Menu"}
        aria-expanded={open}
        aria-controls="site-menu"
        onPress={onToggle}
        className="text-foreground"
      >
        <Icon name={open ? "close" : "menu"} size={24} className="m-0! size-6!" />
      </Button>
      </div>
    </header>
  );
}

const PAGES: [View, string][] = [
  ["map", "Map"],
  ["events", "Events"],
  ["plan", "Guide"],
  ["legacy", "Legacy"],
];

/** Full-page menu that covers the screen under the header. */
function MenuPage({ view, onClose }: { view: View; onClose: () => void }) {
  // with the events sheet (iteration 4) events live on the map, so there is no Events page to list
  const pages = useFeature("eventsSheet") ? PAGES.filter(([v]) => v !== "events") : PAGES;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <nav
      id="site-menu"
      aria-label="Site menu"
      tabIndex={-1}
      ref={(el) => el?.focus({ preventScroll: true })}
      className="bg-background outline-none absolute inset-0 z-40 flex flex-col overflow-y-auto px-4 pt-6 pb-8"
    >
      <ul className="m-0 my-auto flex w-full list-none flex-col items-center gap-2 p-0">
        {pages.map(([v, label]) => {
          const here = v === view;
          return (
            <li key={v}>
              <Button
                variant={here ? "secondary" : "ghost"}
                aria-current={here ? "page" : undefined}
                onPress={() => {
                  onClose();
                  navigate(v);
                }}
                className={cx("w-[200px] font-semibold", here ? "bg-default text-foreground" : "text-foreground")}
              >
                {label}
              </Button>
            </li>
          );
        })}
      </ul>
      <p className="text-muted pt-8 text-center text-xs">
        <span className="font-jp text-accent mr-1.5">リトル東京</span>Little Tokyo, Los Angeles
      </p>
    </nav>
  );
}

/** Desktop-only panel left of the phone: where iteration controls live. */
function ConfigPanel() {
  const iteration = useApp((s) => s.iteration);
  const current = ITERATIONS.find((i) => i.id === iteration) ?? ITERATIONS[0];
  return (
    <Card className="w-[300px] self-start p-6">
      <Card.Header>
        <div className="text-accent text-xs font-semibold tracking-[0.2em] uppercase">Config</div>
        <Card.Title className="text-xl">Iterations</Card.Title>
      </Card.Header>
      <Card.Content className="gap-3">
        <Select
          fullWidth
          aria-label="Iteration"
          placeholder="Choose an iteration"
          value={current.id}
          onChange={(v) => v && setIteration(String(v))}
        >
          <Label className="sr-only">Iteration</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {ITERATIONS.map((i) => (
                <ListBox.Item key={i.id} id={i.id} textValue={i.name}>
                  {i.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <p className="text-muted m-0 text-sm leading-snug">{current.diff}</p>
        <PinConfig />
      </Card.Content>
    </Card>
  );
}

/** Map pins: how much room each full pin needs before its lower-ranked neighbours shrink to points. */
function PinConfig() {
  const space = useApp((s) => s.pinSpace);
  return (
    <div className="border-separator mt-2 flex flex-col gap-3 border-t pt-4">
      <div className="text-foreground text-sm font-semibold">Map pins</div>
      <p className="text-muted m-0 text-sm leading-snug">
        Pins keep one size at every zoom. Where they crowd, the highest-ranked ones stay full dots and the rest shrink to small colour points.
      </p>
      <Slider value={space} minValue={16} maxValue={96} step={2} onChange={(v) => setPinSpace(v as number)} className="w-full">
        <div className="flex items-baseline justify-between">
          <Label className="text-sm font-semibold">Room per pin</Label>
          <Slider.Output className="text-muted text-sm tabular-nums">{({ state }) => `${state.values[0]} px`}</Slider.Output>
        </div>
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
      <p className="text-muted m-0 text-xs leading-snug">
        Less room packs more full pins in; more room turns more of them into points.{" "}
        {space !== PIN_SPACE_DEFAULT && (
          <button type="button" className="text-accent font-semibold" onClick={() => setPinSpace(PIN_SPACE_DEFAULT)}>
            Reset to {PIN_SPACE_DEFAULT} px
          </button>
        )}
      </p>
    </div>
  );
}

export default function App() {
  const phone = usePhone();
  const rawView = useApp((s) => s.view);
  const noAccount = useFeature("noAccount");
  const evSheet = useFeature("eventsSheet");
  const menuPage = useFeature("menuPage");
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const dark = useApp((s) => s.dark) && !noAccount; // iteration 4+: always light
  // views that don't exist in this iteration fall back to the map
  const view = (evSheet && rawView === "events") || (noAccount && rawView === "account") ? "map" : rawView;
  const [screenEl, setScreenEl] = useState<HTMLDivElement | null>(null);
  const getToastContainer = useCallback(() => screenEl ?? document.body, [screenEl]);
  useHashRouter();
  useHostBootstrap();
  // any navigation (menu item, logo, map links from other views) closes the menu
  useEffect(() => setMenuOpen(false), [view]);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.setAttribute("data-theme", dark ? "dark" : "light");
    root.style.colorScheme = dark ? "dark" : "light";
  }, [dark]);

  const screen = (
    <div
      ref={setScreenEl}
      className={cx(
        "bg-background relative isolate flex size-full transform-gpu flex-col overflow-hidden",
        !phone && "rounded-[46px]",
        phone && "pt-[env(safe-area-inset-top,0px)]",
      )}
    >
      {!phone && (
        <div className="bg-background text-foreground flex h-[54px] flex-none items-start pt-[11px]">
          <div className="flex h-[37px] flex-1 items-center justify-center pl-1 text-base leading-none font-semibold tracking-[-0.01em]">
            <Clock />
          </div>
          <div className="w-[126px] flex-none" />
          <div className="flex h-[37px] flex-1 items-center justify-center gap-[7px] pr-1">
            <svg width="19" height="12" viewBox="0 0 19 12" fill="currentColor" aria-hidden="true">
              <rect x="0" y="8" width="3" height="4" rx="1" />
              <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
              <rect x="10" y="3" width="3" height="9" rx="1" />
              <rect x="15" y="0" width="3" height="12" rx="1" />
            </svg>
            <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor" aria-hidden="true">
              <path d="M8.5 2.3c2.4 0 4.6.9 6.3 2.5.1.1.3.1.4 0l1-1c.1-.1.1-.3 0-.4A11.4 11.4 0 0 0 8.5 0C5.5 0 2.7 1.200.4 3.400c-.1.1-.1.3 0 .4l1 1c.1.1.3.1.4 0A8.900 8.900 0 0 1 8.500 2.300Zm0 3.700c1.400 0 2.600.5 3.600 1.400.1.1.3.1.4 0l1-1c.1-.1.1-.3 0-.4a7.600 7.600 0 0 0-10 0c-.1.1-.1.3 0 .4l1 1c.1.1.3.1.4 0 1-.9 2.200-1.400 3.600-1.400Zm2.200 2.600c.1-.1.1-.3 0-.4a4.200 4.200 0 0 0-4.400 0c-.1.1-.1.3 0 .4l1.900 1.900c.1.1.3.1.4 0l2.100-1.900Z" transform="translate(0 .6)" />
            </svg>
            <svg width="27" height="13" viewBox="0 0 27 13" aria-hidden="true">
              <rect x="0.5" y="0.5" width="22" height="12" rx="3.800" fill="none" stroke="currentColor" opacity=".4" />
              <rect x="2" y="2" width="19" height="9" rx="2.500" fill="currentColor" />
              <path d="M24 4.500v4c.8-.3 1.500-1.100 1.500-2s-.7-1.700-1.500-2Z" fill="currentColor" opacity=".45" />
            </svg>
          </div>
        </div>
      )}
      {view !== "home" &&
        (menuPage ? <MenuBar view={view} open={menuOpen} onToggle={() => setMenuOpen((o) => !o)} /> : <SiteHeader view={view} />)}
      <div className="bg-background relative min-h-0 flex-1">
        {menuPage && menuOpen && view !== "home" && <MenuPage view={view} onClose={closeMenu} />}
        {view === "home" && <section className="absolute inset-0"><HomeView /></section>}
        <section className={cx("absolute inset-0", view !== "map" && "hidden")}>
          <MapView active={view === "map"} />
        </section>
        {view === "events" && <section className="absolute inset-0"><EventsView /></section>}
        {view === "plan" && <section className="absolute inset-0"><PlanView /></section>}
        {view === "legacy" && <section className="absolute inset-0"><LegacyView /></section>}
        {view === "account" && <section className="absolute inset-0"><AccountView /></section>}
      </div>
      {!phone && (
        <div className="bg-surface-secondary flex flex-none items-center gap-2.5 px-3.5 pt-2 pb-[22px]">
          <span className="text-muted w-[22px] text-center text-sm">‹</span>
          <div className="bg-default text-foreground/80 flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm">
            🔒 {SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </div>
          <span className="text-muted w-[22px] text-center text-sm">⟳</span>
        </div>
      )}
      {/* toasts render inside the phone screen (top), not the browser window */}
      <UNSAFE_PortalProvider getContainer={getToastContainer}>
        <Toast.Provider placement="top" />
      </UNSAFE_PortalProvider>
    </div>
  );

  return phone ? (
    <div className="bg-background h-dvh w-full">{screen}</div>
  ) : (
    <div className="bg-background-secondary flex min-h-full flex-wrap items-center justify-center gap-10 px-4 py-7">
      {/* dev only: the production build has no Config panel */}
      {import.meta.env.DEV && <ConfigPanel />}
      <div className="relative h-[844px] w-[390px] flex-none rounded-[58px] bg-[#0a0a0a] p-3 shadow-[0_40px_90px_rgba(0,0,0,.35),inset_0_0_0_2px_#2a2420]">
        <div className="pointer-events-none absolute top-[23px] left-1/2 z-[60] h-[37px] w-[126px] -translate-x-1/2 rounded-full bg-black" />
        {screen}
      </div>
      <Card className="max-w-[400px] p-6">
        <Card.Header>
          <div className="text-accent text-xs font-semibold tracking-[0.2em] uppercase">ACAD-376 · Little Tokyo project</div>
          <Logo className="mt-3 mb-1 rounded-[10px] border-4 px-3.5 pt-1 pb-2 text-[54px] leading-[0.84]" />
          <Card.Title className="sr-only">Little Tokyo</Card.Title>
          <Card.Description className="text-sm">
            A mobile website for visitors: an interactive map of every shop, restaurant and landmark on the official Little Tokyo
            visitor map, with photos, hours, parking, restrooms, walking directions and an events calendar.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <ul className="text-muted m-0 list-disc pl-[18px] text-sm">
            <li className="my-0.5">Drag to move the map, scroll or use + / − to zoom</li>
            <li className="my-0.5">Tap any pin for photos, hours and the business's story</li>
            <li className="my-0.5">Tap the pin button to set where you are, then get walking times</li>
            <li className="my-0.5">Plan a day by chatting or talking with the AI planner</li>
          </ul>
        </Card.Content>
        <Card.Footer className="gap-3.5">
          <div className="grid size-[116px] place-items-center rounded-2xl bg-white p-2 shadow-[0_0_0_3px_var(--accent)]">
            <QRCodeSVG value={SITE_URL} size={100} fgColor="#1b2130" bgColor="#ffffff" level="M" />
          </div>
          <span className="text-muted text-sm">Scan to open it on your phone.</span>
        </Card.Footer>
      </Card>
    </div>
  );
}
