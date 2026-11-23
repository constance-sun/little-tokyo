import { useState, type FormEvent, type ReactNode } from "react";
import { Button, Card, Chip, Input, Label, ListBox, Select, TextField, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { EmptyNote, ListRow, Note, PageHeader, Sect, Tile } from "@/components/common";
import { BY, PLACES, POI } from "@/lib/data";
import { Icon } from "@/lib/icons";
import { cx } from "@/lib/cx";
import {
  navigate, openOnMap, persistAccount, resetSurvey, setPlan, setSurvey, setTheme, signOut, subscribeNewsletter,
  toast, unsubscribeNewsletter, useApp, type ThemeMode,
} from "@/state/store";
import { OwnerBox } from "./account/OwnerBox";

/* ======================================================================
   ACCOUNT: visitors save places, plans and preferences, and can join the newsletter.
   Business owners link their business (business tools come later).
   Synced to the host account where available; otherwise saved on this device.
   ====================================================================== */

/** Labels for the plan survey's interest picks (mirrors the planner's survey options). */
const PICK_LABELS: Record<string, Record<string, string>> = {
  food: { ramen: "Ramen & noodles", sushi: "Sushi", cafes: "Cafés & sweets", bbq: "Korean BBQ & grill", comfort: "Japanese comfort food", bars: "Bars & drinks" },
  shop: { gifts: "Gifts & souvenirs", anime: "Anime & manga", fashion: "Fashion & sneakers", books: "Books", home: "Ceramics & home", artcraft: "Art & crafts" },
  explore: { temples: "Temples & history", museums: "Museums", shows: "Theater & music", plazas: "Plazas & gardens", events: "Events that day" },
};

const THEMES: [ThemeMode, string, string][] = [["auto", "Auto", "phone"], ["light", "Light", "sun"], ["dark", "Dark", "moon"]];

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <Card className={cx("gap-3 p-4", className)}>{children}</Card>;
}
const Q = ({ children }: { children: ReactNode }) => <div className="font-display text-base font-bold tracking-[-0.02em]">{children}</div>;

export default function AccountView() {
  const acct = useApp((s) => s.acct);
  const acctMode = useApp((s) => s.acctMode);
  const meInfo = useApp((s) => s.meInfo);
  const saved = useApp((s) => s.saved);
  const survey = useApp((s) => s.survey);
  const themeMode = useApp((s) => s.themeMode);
  const [email, setEmail] = useState(acct.newsletter?.email || meInfo?.email || "");
  const who = meInfo?.name || null;

  const page = (body: ReactNode) => <div className="h-full overflow-y-auto overscroll-contain px-4 pt-5 pb-8">{body}</div>;

  if (!acct.type)
    return page(
      <>
        <PageHeader title="Join Little Tokyo" lede="Save spots, keep plans, get the monthly letter." />
        <Card className="p-3">
          <div className="grid grid-cols-2 gap-2">
            <Tile big on={false} label="I'm visiting" icon="people" onClick={() => { void persistAccount({ type: "visitor" }); toast("Visitor account created"); }} />
            <Tile big on={false} label="I own a business" icon="store" onClick={() => void persistAccount({ type: "business" })} />
          </div>
        </Card>
        <Note className="mt-3 px-1">
          {acctMode === "cloud" ? `You'll be signed in with your account${who ? " (" + who + ")" : ""}, so it works on every device.` : "Saved on this phone for now."}
        </Note>
      </>,
    );

  const biz = acct.business ? BY[acct.business] : undefined;
  const sp = saved.map((id) => BY[id]).filter(Boolean);
  const picks = Object.entries(PICK_LABELS).flatMap(([g, labels]) =>
    survey.groups.includes(g) ? (survey.picks[g] || []).map((k) => labels[k] || k) : [],
  );
  const nl = acct.newsletter;
  const bizOptions = PLACES.filter(POI).sort((a, b) => a.name.localeCompare(b.name));

  const subscribe = (e: FormEvent) => {
    e.preventDefault();
    const v = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
      toast("Enter a valid email address");
      return;
    }
    void subscribeNewsletter(v);
  };

  return page(
    <>
      <PageHeader title={who ? "Hi, " + who.split(" ")[0] : "Your account"} />
      <div className="-mt-2 mb-4 flex flex-wrap items-center gap-2">
        <Chip color="accent" variant="primary">
          <Icon name={acct.type === "business" ? "store" : "people"} size={13} />
          {acct.type === "business" ? "Business owner" : "Visitor"}
        </Chip>
        <Note>{acctMode === "cloud" ? "Synced to your account" : "Saved on this device"}</Note>
        <Button
          size="sm"
          variant="ghost"
          className="text-accent ml-auto"
          onPress={() => void persistAccount({ type: acct.type === "business" ? "visitor" : "business" })}
        >
          Switch type
        </Button>
      </div>

      {acct.type === "business" && (
        <Panel>
          <Select
            fullWidth
            placeholder="Choose your business"
            value={acct.business || null}
            onChange={(v) => void persistAccount({ business: v ? String(v) : null })}
          >
            <Label className="font-display text-base font-bold tracking-[-0.02em]">Your business</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {bizOptions.map((p) => (
                  <ListBox.Item key={p.id} id={p.id} textValue={p.name}>
                    {p.name}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          {biz && (
            <div>
              <ListRow p={biz} right="View" onClick={() => openOnMap(biz.id)} />
              {biz.cat === "eat" && <OwnerBox p={biz} />}
            </div>
          )}
          <Card variant="secondary" className="gap-1 p-3 text-sm">
            <b className="text-foreground font-semibold">Business tools coming soon</b>
            <span className="text-muted">Photos, hours, menus, a note to visitors. We check ownership first.</span>
          </Card>
        </Panel>
      )}

      <Sect action={sp.length ? <Chip size="sm" variant="soft">{sp.length}</Chip> : undefined}>Saved places</Sect>
      {sp.length ? (
        <Panel className="gap-0 px-3 py-1.5">
          {sp.map((p) => <ListRow key={p.id} p={p} right="Open" onClick={() => openOnMap(p.id)} />)}
        </Panel>
      ) : (
        <EmptyNote>Tap Save on any place to keep it here.</EmptyNote>
      )}

      <Sect action={acct.plans.length ? <Chip size="sm" variant="soft">{acct.plans.length}</Chip> : undefined}>Saved plans</Sect>
      {acct.plans.length ? (
        <div className="flex flex-col gap-2.5">
          {acct.plans
            .slice()
            .reverse()
            .map((pl, i) => (
              <Panel key={(pl.savedAt || 0) + "-" + i}>
                <div className="flex items-baseline justify-between gap-2">
                  <b className="font-display text-base font-extrabold tracking-[-0.025em]">{pl.title || "My day"}</b>
                  <Chip size="sm" variant="soft" color="accent">
                    {(pl.date ? new Date(pl.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " : "") +
                      pl.stops.length + " stops"}
                  </Chip>
                </div>
                <Note className="text-sm leading-normal">{pl.stops.map((s) => BY[s.id]?.name).filter(Boolean).join(" → ")}</Note>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onPress={() => { setPlan(pl); navigate("plan"); }}>Open</Button>
                  <Button size="sm" variant="danger-soft" className="flex-1" onPress={() => void persistAccount({ plans: acct.plans.filter((x) => x !== pl) })}>
                    Delete
                  </Button>
                </div>
              </Panel>
            ))}
        </div>
      ) : (
        <EmptyNote>No saved plans yet.</EmptyNote>
      )}

      <Sect>Preferences</Sect>
      <Panel>
        <Q>Interests</Q>
        {picks.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {picks.map((l) => (
              <Chip key={l} size="sm" variant="soft" color="accent">{l}</Chip>
            ))}
          </div>
        ) : (
          <Note>No interests picked yet.</Note>
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" className="flex-1" onPress={() => { setSurvey({ step: 1 }); navigate("plan"); }}>Edit interests</Button>
          <Button size="sm" variant="tertiary" className="flex-1" onPress={() => { resetSurvey(); toast("Preferences reset"); }}>Reset</Button>
        </div>
        <div className="bg-separator my-1 h-px" />
        <Q>Appearance</Q>
        <ToggleButtonGroup
          fullWidth
          selectionMode="single"
          disallowEmptySelection
          aria-label="Appearance"
          selectedKeys={new Set([themeMode])}
          onSelectionChange={(keys) => {
            const k = [...keys][0];
            if (k) setTheme(k as ThemeMode);
          }}
        >
          {THEMES.map(([k, l, icon], i) => (
            <ToggleButton key={k} id={k} className="gap-1.5">
              {i > 0 && <ToggleButtonGroup.Separator />}
              <Icon name={icon} size={15} />
              {l}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Note>Auto matches your device.</Note>
      </Panel>

      <Sect>Newsletter</Sect>
      <Panel>
        <Note className="text-sm">Once a month: openings, festivals, old shops.</Note>
        {nl ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <Chip size="sm" variant="soft" color="success">✓ Subscribed</Chip>
              <span className="text-muted truncate text-sm">{nl.email}</span>
            </div>
            <Button size="sm" variant="tertiary" fullWidth onPress={() => void unsubscribeNewsletter()}>Unsubscribe</Button>
          </div>
        ) : (
          <form className="flex items-end gap-2" onSubmit={subscribe}>
            <TextField className="min-w-0 flex-1" type="email" value={email} onChange={setEmail} aria-label="Email for the newsletter">
              <Input placeholder="you@example.com" variant="secondary" className="text-sm" />
            </TextField>
            <Button type="submit">Subscribe</Button>
          </form>
        )}
      </Panel>

      <Button variant="danger-soft" fullWidth className="mt-6" onPress={signOut}>Sign out</Button>
    </>,
  );
}
