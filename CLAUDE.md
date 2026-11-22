# Little Tokyo Guide

A phone-first visitor website for Little Tokyo, Los Angeles (course project ACAD-376). It has an interactive map of every shop, restaurant and landmark on the official Little Tokyo visitor map, an events calendar, a day planner, a legacy-business timeline and a visitor/business account.

It started as one self-contained `index.html` (now kept at `original/index.html` for reference). This repo is the React + HeroUI rebuild of that page. **Features must match the original feature for feature** (the spec below describes what the original does and is the source of truth for behaviour). **The visual design is deliberately new**: HeroUI v3's soft, rounded look instead of the original's square paper poster style (see "Design").

---

## Running it

```bash
npm install
npm run dev        # Vite dev server → http://localhost:5173
npm run build      # typecheck (tsc -b) + production build to dist/
npm run preview    # serve the production build
npm run typecheck
```

## Stack

- **Vite + React 19 + TypeScript** (strict).
- **Tailwind CSS v4** via `@tailwindcss/vite`. Theme tokens live in `src/index.css`.
- **HeroUI v3** (`@heroui/react` + `@heroui/styles`, built on React Aria) is the only component library. No shadcn, Radix or lucide. Components are compound (`<Card><Card.Header/>…</Card>`, `<Tabs><Tabs.ListContainer><Tabs.List><Tabs.Tab id=…>`, `<Select><Select.Trigger/><Select.Popover><ListBox>…`). Events use React Aria names (`onPress`, `onSelectionChange`, `onChange(value)`, `isSelected`, `isDisabled`). Docs: https://heroui.com/en/docs/react/components/<name> (append `.mdx` for raw markdown).
- `UNSAFE_PortalProvider` (from `react-aria`) points the HeroUI toast region at the phone screen. Call `toast()` from the store, which wraps HeroUI's `toast`.
- `qrcode.react` draws the QR code beside the phone frame.
- No backend. Data is static JSON and state is `localStorage`. An optional host runtime (`window.claude`, see "Host integrations") adds shared live data when present.

## Layout of the code

```
original/index.html      the original single-file site (reference only, not served)
public/images/           68 photos extracted from the original's base64 blobs
src/data/*.json          data extracted from the original (see "Data")
src/lib/
  types.ts               Place, EventItem, Plan, ChatMsg…
  data.ts                merges BASE list + research + logistics → PLACES, BY, CATS, SUBS, ECAT, eventVenue
  hours.ts               LA-time opening hours: laNow, openState, ranges, fmtT, openAt
  route.ts               street-graph walking router (Dijkstra), walkM, nearest, stepName
  waits.ts               wait-time summaries (researched + live)
  planner.ts             day-plan builder, offline chat replies, AI prompt
  claude.ts              optional host bridge + browser speech recognition fallback
  icons.tsx              the single line-icon family (<Icon name=…/>)
  storage.ts, format.ts  localStorage JSON wrapper; m/min/domain/ago formatters
src/state/
  store.ts               global store (useSyncExternalStore) + all actions
  host.ts                connects to host db/user on boot (live waits, cloud account)
src/components/common.tsx  shared HeroUI-based blocks: Page, PageHeader, Sect, Label, Note, EmptyNote, LegacyChip, ListRow, Tile, CatDot, Logo
src/lib/cx.ts            class-name joiner
src/views/               HomeView, map/ (MapView + parts), EventsView, PlanView, LegacyView, AccountView
src/App.tsx              phone frame vs full screen, header + menu, hash router, view switching
```

Conventions:
- Use HeroUI components and HeroUI theme tokens before reaching for custom CSS. The tokens are: `bg-background`, `bg-surface`, `bg-surface-secondary`, `bg-overlay`, `bg-default`, `text-foreground`, `text-muted`, `bg-accent`, `text-accent`, `bg-accent-soft`, `border-separator`, `shadow-[var(--surface-shadow)]`.
  - In HeroUI, **`muted` is a text colour**, so never write `bg-muted`.
  - `accent` is the brand red.
  - The map is the exception: pins, clusters and stop markers have their own CSS in `src/views/map/map.css`.
- Cross-view navigation goes through store actions such as `navigate`, `openOnMap(id)` and `showPlanOnMap(plan)`. Don't touch `location.hash` directly from views.
- Keep the `localStorage` keys listed below unchanged so saved data carries over from the original.
- Walking distance always comes from `walkM`/`route` on the real street graph, never from straight-line distance (except the ×1.3 fallback).

---

# Feature spec (what exists today)

## 1. Frame and navigation

- **Computer (width over 700px, fine pointer).** The site renders inside a 390×844 phone frame with a dynamic island, a status bar with a live LA clock ("9:41" style, refreshed every 30s, with 5G and battery glyphs), and a fake browser bar showing `constance-sun.github.io/little-tokyo`. Beside the frame sits an "about" panel:
  - an "ACAD-376 · Little Tokyo project" eyebrow and the big boxed logo
  - a one-paragraph description
  - four usage tips
  - a QR code for `https://constance-sun.github.io/little-tokyo/` with a red ring
- **Phone (width 700px or less, or a coarse pointer on a small screen).** The site fills the screen with no frame chrome and respects safe-area insets.
- **Config panel.** On computers, a "Config" card sits left of the phone frame. It is where iteration controls live. It currently holds one dropdown that tracks the design iteration (stored as `lt-iteration`) and a 1-2 line note on what differs in that iteration. The list is `src/lib/iterations.ts`. Each iteration lists `features` the app reads with `iterationHas(id, feature)`; read them in components with `useFeature(f)` from the store. Iterations 1 and 2 don't change the UI. The features are:
  - `satellite` (iterations 3 and 4)
  - `eventsSheet`, `mapChips` and `noAccount` (iteration 4, the default; see "Iteration 4" below) Hidden on phones.
- **Header** (hidden on the cover page). It shows the boxed red wordmark `little– / tokyo` (Archivo Black, links to the cover), a light/dark toggle (sun/moon), and an account button (person icon, filled red while on Account).
- **Top menu** with numbered items: `01 Map · 02 Events · 03 Plan a day · 04 Legacy`. The current item is underlined in red with a red number. Items are spaced evenly.
- **Hash router.** The views are `#home #map #events #plan #legacy #account`, and unknown hashes go to home. **The site always opens on the cover page**: any hash on first load is stripped.
- **Toast.** A red pill near the top of the screen that disappears after 2.4s.
- **Look (original).** Crisp white paper and near-black ink with one strong red. Corners were square-ish (about 2px), cards flat with hairline rules, with a subtle paper-grain overlay.
- **Design (rebuild).** HeroUI's default theme, branded:
  - colour: a light-grey background with white rounded surfaces and soft shadows; the accent is the Little Tokyo red (`--accent` in `src/index.css`)
  - shape: `--radius: 0.75rem`, pill chips and buttons, segmented tabs
  - type: Archivo everywhere, Archivo Black for the boxed `little– tokyo` logo, Zen Kaku Gothic New for Japanese
- **Theme.** The modes are Match device, Light and Dark, stored as `lt-theme`. Match device follows `prefers-color-scheme` live. Every map colour has a light and a dark variant.

## 2. Cover page (`#home`)

- A framed cover photo (72% wide) on paper, with a red sun circle peeking from behind its top-right corner.
- A red vertical **東京** above the photo, and vertical tracked captions at the left ("Los Angeles · California") and right ("Japanese American · Neighborhood").
- The boxed **little– tokyo** logo, rotated −7°, overlaps the photo's bottom-left edge. It "slams" onto the card with a 0.5s stamp animation after 0.9s (disabled under reduced motion). A red vertical **リトル東京** sits next to it.
- A full-width red **"Enter Little Tokyo →"** button goes to the map.

## 3. Map (`#map`)

### Iteration 4 (Google Maps style, default)
- **Events sheet.** Events live in a bottom sheet on the map (`EventsBody compact` from `EventsView.tsx`), and there is no Events tab; `#events` shows the map.
  - The sheet never closes. It snaps to peek (title, "N events this week", category pills), half and full.
  - Tapping the peeking sheet raises it to half. Tapping empty map lowers it back to peek.
- **Detail sheet.** Place, route, plan and event details open in the existing detail sheet. It slides in over the events sheet (z 20 over 19), and closing it reveals the events sheet again.
  - An event opens at full height with a "‹ Events" button that closes it.
- **Chips and buttons.** Parking and Restrooms come right after All in the chip row. The floating restroom, parking and zoom buttons are gone; only "Set where I am" remains. Pinch, wheel and double-tap still zoom.
- **No accounts or dark mode.** The account button, the Account page (`#account` shows the map), Save/Saved on places, Save plan, the owner wait box and the light/dark toggle are hidden. The app is always light.
- **Map credit.** The imagery/OSM credit floats just above whichever sheet is showing.

### 3.1 Base map

- **Satellite (iteration 3, default).** Esri World Imagery tiles are drawn under everything as SVG `<image>`s placed in map metres (`src/views/map/imagery.ts`). Zoom 17 always covers the whole map; finer tiles (up to z20; z21 is a placeholder here) load for the visible area. In this mode the drawn ground, streets, green areas and building shadows are hidden. Buildings show only as translucent tints when a filter or selection lights them. Street and plaza names turn white with a dark halo. The credit reads "Imagery © Esri, Maxar, Earthstar Geographics · © OpenStreetMap". Styles are under `.mapbox.sat` in `map.css`.
- **Georeference.** Map (0,0) is 34.0495° N, 118.2400° W: plain equirectangular, x = Δlon × 111320 × cos(34.0495°), y = −Δlat × 110574, no rotation. This was fitted against OSM building nodes, with a 3 cm median error.

- The map is drawn from real OpenStreetMap geometry (`geo.json`, with x east and y south). Its bounds are `[-400,-340,560,520]`. It contains:
  - 339 building footprints
  - 464 road polylines
  - 86 areas (green, plaza, parking lot)
  - a 1,627-node / 1,708-edge walking graph
- **Layer order:** ground, then areas (green, plaza, parking lots), then street casing, then street fill. Street widths follow road class. Footways and steps are dotted, and pedestrian ways use the plaza colour.
- After the streets come building shadows and building footprints, then street names, then plaza labels, then the route layer.
- **Buildings** are drawn only if they contain a place (POI, parking or restroom) or are flagged as parking. Empty buildings are left off so the ground reads cleaner. Buildings that hold only parking are shown only under the Parking filter.
- **Street names** follow the road on a `textPath`. Only roads 70m or longer are labelled, at most 3 labels per street name, and the text is abbreviated (`E 1st St`, `Onizuka`, …) and uppercase. Names hide below zoom 0.8.
- **Plaza labels:** Weller Court, Honda Plaza, Little Tokyo Galleria, JANM Plaza and Noguchi Plaza. They hide below zoom 1.
- Parking lots (areas) are visible only under the Parking filter.
- A "© OpenStreetMap" link sits bottom right and a scale bar (10/20/50/100/200/500 m) sits bottom left. Both move up with the bottom sheet.

### 3.2 Camera and gestures

- The camera is centre `(cx,cy)` in metres plus zoom `z` in px per metre. Zoom runs from `ZMIN` (the bounds fill the view) to 7, and the view can never leave Little Tokyo.
- **Gestures:** drag to pan (a 6px threshold before it counts as a drag), pinch to zoom around the midpoint, mouse wheel to zoom around the cursor, double-tap to zoom ×1.8, and the + / − buttons (×1.6).
- `flyTo` animates with cubic ease-in-out, or jumps instantly under reduced motion.
- **Intro:** the first time the map opens, it starts fully zoomed out and flies in to around (−30, 15) over 1.5s.
- **Tapping:**
  - Tapping empty map closes the sheet.
  - Tapping inside a building opens the place in that building, if its pin is visible.
  - In "set where I am" mode, a tap sets the start point.

### 3.3 Places and pins

- **Places come from three sources:**
  - 70 numbered or famous places from the official visitor map. This includes 66 numbered entries, plus Daikokuya and Marugame Monzo, Japanese Village Plaza, and the Metro station. Each is merged with research data: status, type, address, phone, website, hours, price, admission, description, "known for", year since, legacy flag, owner story, parking, restroom and sources.
  - 17 researched parking garages and lots, plus up to 10 extra "Public parking" spots from the visitor map. These are skipped when within 30m of a known garage.
  - 8 restrooms.
- **Categories and colours:** Eat, Shop, Explore, Parking, Restroom and Metro.
- **Glyphs.** Each place gets a glyph from its type, tags and name: ramen, sushi, sweets, cafe, bar, dining, books, art, shop, temple, church, museum, theater, music, lantern (JVP) or people.
- **Sub-types** feed the Filter panel:
  - Eat: ramen, sushi, comfort, bbq, cafes, snacks, bars, intl
  - Shop: gifts, anime, fashion, books, home, artcraft
  - Explore: temples, churches, museums, arts, community
- **Pin appearance:**
  - A pin is a round dot in the category colour with a white line icon. Parking and restroom pins are rounded squares.
  - Size depends on zoom: small below 1.1, normal below 2.3, and labelled above that.
  - Legacy places get a gold outline, and closed places are grey.
  - The selected pin is scaled ×1.3 and always labelled.
- **Labels** follow Apple-Maps style:
  - placed to the right of the pin, in a darker version of the category colour, bold
  - up to 2 lines, max 112px wide, with a crisp white halo
  - parking pins show their short rate (e.g. "$15 day max") instead of the name
- **Decluttering.** Labels are hidden where they would collide. Priority goes to the selected place, then legacy, then food, then shop and explore.
- **Clusters.** Pins of the same category that overlap on screen (within 30/26/20px depending on zoom, below zoom 5) collapse into a coloured bubble with a count ("2", "3+", "9+"). Tapping a bubble zooms to fit its members.
- **Building tint by filter:**
  - Under "All", buildings with places get a soft tint.
  - Under a category, matching buildings light up in that colour (gold for Legacy) and others go quiet.
  - The selected place's building is highlighted.

### 3.4 Search, filters, buttons

- **Search box** ("Search Little Tokyo", with a clear ✕). It matches name, type, tags, description and known-for, and shows up to 8 results. Each result has its icon, type, a ★ Legacy flag and the open state. Picking one opens the place. With no matches it says "No matches in Little Tokyo".
- **Filter chips** (single choice; tap the active chip again to return to All):
  - **All**
  - **Eat**, **Shop**, **Explore**
  - **Legacy** (gold)
  - **Open now**, with a toast "N places open right now"
  - **Parking**, with a toast "Tap a garage for rates."
  - **Restrooms**, with a toast "Tap one for access."
  - **Closed / moved**
- **Visibility rules:**
  - Closed and moved places are hidden unless the "Closed / moved" filter is on or the place is selected.
  - Parking shows under Parking, when selected or a route target, or under All at zoom 1.6 and above.
  - Restrooms show under Restrooms, after the restroom button has been used, or when selected or a route target.
  - The Metro is always shown.
- **Filter button** (for Eat, Shop and Explore). It is labelled "Filter: All types" or with the chosen types and wait, and has a Clear link. It opens a panel with:
  - For Eat only: a **Wait time** radio (Any wait, Under 10, 30 or 60 min). Options with no matches are disabled, and a note reads "Busy-time waits, from reviews and owners."
  - Type checkboxes with icons and counts.
  - A Done button.
  - The filter is saved as `lt-filter` and the types as `lt-subs`.
- **Buttons on the right:**
  - 📍 **Set where I am**: the next tap on the map sets the start point (`lt-me3`), with the toast "Start point set." The default start is the Metro station, labelled "Start: Metro".
  - 🚻 **Nearest restroom**: routes from the selected place, or from you if nothing is selected.
  - 🅿️ **Nearest parking**: routes from the nearest garage to the selected place or to you.
  - **+** and **−** zoom.
- The start point is drawn as a red dot labelled "Start: Metro" or "You".

### 3.5 Bottom sheet (place details)

- **Behaviour.** The sheet has a drag handle and snaps to four heights: closed, peek (about 250px), half (60%) and full. Tapping the handle toggles between full and half, and dragging it below about 60% of peek closes the sheet. The search bar hides when the sheet is full.
- **Header:**
  - A horizontal photo strip with scroll-snap. Each photo carries a caption and an author · license credit with a link. Places with no photo show a category-coloured placeholder with the icon and "Photo coming soon".
  - The name, then a category pill (type · price), then "★ Legacy · since YYYY".
  - The open state, live in LA time: "Open · Closes 9 PM", "Closed · Opens tomorrow 11 AM", or "Hours not confirmed". This is followed by "· N min walk" from your start point.
  - For restaurants, a wait pill: live in green, otherwise the researched figure.
- **Status banners:**
  - "Permanently closed." or "Moved away.", with a note
  - "Temporarily closed."
  - "Status not confirmed."
- **Actions:** **Directions** (primary), **Parking** (nearest), **Restroom** (nearest), **Save**/**Saved** (★, stored as `lt-saved`) and **Copy** (name and address).
- **Parking, restroom and Metro pages** are a single info panel:
  - address and description
  - a rates table with source, date and confidence, e.g. "From X, 2026. Confirm on site.", or "Rates not confirmed / Check the sign"
  - entrance, garage or surface lot, validation, hours
  - restroom access with a confirmed/likely flag
  - the Metro description and the source
- **Tabs for POIs** (Overview / About / Their story):
  - **Overview:**
    - address with a Copy button
    - for Eat: wait time (summary, peak and off-peak tip, basis, confidence, reservations, source)
    - a weekly hours table with today in bold, the hours source, and "checked Nov 2026. Confirm before you go."
    - admission, phone with Copy, website
    - parking: has own / none / not confirmed, the nearest garage with walk time, and a **Route** button
    - restroom: here or not confirmed, the nearest likely restroom with walk time, and a **Route** button
    - for restaurants, an **owner wait box** ("Own this restaurant?"): buttons No wait/10/20/30/45/60+ min and Clear, which post to the shared `waits` collection, with "Owner tools aren't live yet" when there is no host database
    - **Nearby**: the 4 nearest open POIs with walk-time pills
  - **About:** description, a "Known for" chip list, "In Little Tokyo since YYYY (about N years)", and up to 3 source links.
  - **Their story:** the owner story or history card (titled "A Little Tokyo legacy business" for legacy places) with its source, plus a dashed "A note from the owner: Owner stories coming soon." box.

### 3.6 Walking directions

- **Routing.** The router runs Dijkstra on the street and walkway graph, restricted to its largest connected component. Endpoints snap to the nearest edge. Distance is real metres, walking time assumes 80 m/min, and results are cached per place pair.
- **Directions bar.** It replaces the search and chips and shows:
  - a From select and a To select, grouped as My spot/Metro, Eat, Shop, Explore, Parking, Restrooms and Transit
  - a ⇅ swap button and a ✕ close button
  - picking the same place twice gives the toast "Pick two different places"
- **Route drawing.** The route is drawn as a white casing, a soft blue line and a dotted blue line, with a start dot. The map fits the route.
- **Route panel:**
  - the big walk time and the distance
  - "Label: From → To. Walking time at an easy pace, plaza walkways included."
  - steps: Start at …, Head along / Continue on {street} with metres, Arrive at …
  - a **Back** button

### 3.7 A day plan on the map

- **"See on map"** from the planner draws every walking leg, starting from you or from the parking. If driving, the route runs parking, then the stops, then back to the parking.
- **Markers.** Stops get numbered red markers and the parking gets a blue **P**. Regular pins are hidden in this mode.
- **Selecting a leg.** Tapping a stop or a walk row highlights that leg (a thick solid line with a "N min walk" tag at its midpoint) and fits it. The other legs stay faded and dotted.
- **Plan sheet:**
  - the total or current leg time
  - "Start at the Metro station" or "Start from your spot"
  - stop rows with the number, name, time · type and a **Details** button
  - walk rows ("N min walk · m", "to {next} ›")
  - "Back to your car at …"
  - **Whole route** and **Close plan** buttons
  - after the last stop, the toast "That's the last stop. Enjoy!"

## 4. Events (`#events`)

- **Header and filter.** The page is titled "What's on" with the lede "Festivals, pop-ups, shows." Category chips: All, Festival, Pop-up, Music, Theater, Art & film, Community, Food and Exhibit, each with a coloured icon dot.
- **Calendar header.** A month name with ‹ › buttons. It defaults to the current month in LA, with today selected.
- **Ruled calendar grid:**
  - an S M T W T F S header row
  - day cells 58px tall
  - days outside the month are tinted, and weekends get a light tint
  - day numbers are faint unless the day has events
  - today's number sits in a red circle
  - the selected day has a red outline and a soft fill
  - up to 2 category icons per day, plus "+n"
- **Day and upcoming lists.** Below the grid is the selected day as a heading, then that day's events, or "Nothing on. Pick a day with a dot." Next is **Coming up** with the next 14 events that haven't ended. A footnote explains "Date to confirm".
- **Event cards** are 170px tall:
  - the photo under a dark gradient, or a category gradient with a big faded icon when there is no photo
  - the category, and a "Date to confirm" badge when the date is unconfirmed
  - the date range or day plus the time, and the title
- **Event detail** is a full-screen overlay:
  - a hero photo with a "‹ Events" back button, the category and the title
  - facts: When, Where, Price
  - a date-to-confirm banner, the description and "Repeats: …"
  - **Show on map**, when the venue matches a known place such as JANM, JACCC, JVP, Union Center or Go For Broke, or a name match
  - **Organizer page ↗** and the photo credit
- **Data:** 29 events from Nov 2026 to Oct 2027. Categories: festival 8, community 7, exhibit 4, and 2 each of food, art, popup, theater and music.

## 5. Plan a day (`#plan`)

- The page is titled "Plan your day" with the lede "Four questions. Or just say it."
- **Hold to talk.** A big red mic button:
  - Hold it to talk and let go to plan. A tap shorter than 450ms switches to tap-to-start / tap-again-to-stop.
  - Space and Enter work on the keyboard.
  - It shows the live partial transcript.
  - What was said is sent as "Plan my day from scratch: …", shown as "🎙 …".
  - Without speech support it says "Voice works in Chrome and Safari." A blocked mic gives the toast "Mic is blocked. Allow it in settings."
- **Survey.** A 4-step card with a step indicator 01–04 (When / Interests / Details / Getting here). Steps are clickable, and answers persist as `lt-survey`:
  1. **When:** a date (today or later) and a start time (default 11:00), then **2 hours / Half day / Full day**.
  2. **Interests:** big tiles for Food, Shopping and Experiences (multi-select, at least one).
  3. **Details:** chips for each chosen group.
     - Food: Ramen & noodles, Sushi, Cafés & sweets, Korean BBQ & grill, Japanese comfort food, Bars & drinks.
     - Shopping: Gifts & souvenirs, Anime & manga, Fashion & sneakers, Books, Ceramics & home, Art & crafts.
     - Experiences: Temples & history, Museums, Theater & music, Plazas & gardens, Events that day.
     - A checkbox: "Include legacy businesses".
  4. **Getting here:** Driving / Metro / Walk or rideshare / Skip. If driving, choose **Cheapest** or **Closest to my stops** parking, plus "Start and end my plan at the parking".
  - **Build my day** builds the plan, posts "Here's your day. 👎 a stop to swap it." to the chat, and scrolls to the result.
- **Plan builder (offline, deterministic, with a seeded random):**
  - **Number of stops:** 3, 5 or 8 by length.
  - **Slots:** one meal (two for a full day) is placed mid-day and/or last. The other slots cycle through explore, shop, café and shop.
  - **Candidates** must be open, not excluded and not avoided, must fit the slot, and must be open on arrival with 20 minutes to spare on the plan day.
  - **Score:** +2.5 for legacy (if wanted), +0.4 for having a photo, −walk/220, +random×1.4, +0.3 if popular.
  - **Stay length:** meal 60 min, café 20, shop 25, explore 45.
  - **Events:** if "Events that day" is picked, an event at a known venue is inserted as stop 3.
  - **Parking:** when driving with parking in the plan, it picks the cheapest priced garage (max rate) or the nearest. Valet and church lots are excluded.
  - **Titles:** "A quick taste of / An afternoon in / A full day in Little Tokyo".
  - **"Why" line:** legacy since YYYY, "You picked X and Y.", and the first sentence of the description.
- **Plan card:**
  - an optional "Park first" P stop
  - for each stop: "N min walk" from the previous one, then the number, time · minutes, category dot, name, ★, the why line and "⏱ wait"
  - 👍 Keep, 👎 Swap (adds to `lt-avoid` and asks for a swap) and Details (opens on the map)
  - "Back to your car"
  - "About N min of walking in total"
  - **See on map** and **Save plan / Saved ✓** (needs an account; otherwise the toast "Create a free account to save plans" and a jump to Account)
  - an optional tip
  - the current plan persists as `lt-plan`
- **"Tweak it" chat:**
  - a chat log (last 30 messages, stored as `lt-chat`)
  - "Thinking…" with a spinner
  - suggestion chips: Less walking, Swap lunch, Add a museum, Cheaper, End by 4pm
  - a mic toggle for dictation into the box, an auto-growing textarea (Enter sends), a send button and Clear chat
  - empty-state hint: "Try "ramen instead of sushi" or "done by 3.""
  - **With the host AI** (`sample.json`), the prompt contains:
    - the survey answers and the avoided places
    - a directory of usable places (id, name, type, legacy, that day's hours, wait, position, description) and the parking list
    - the current plan
    - an instruction to reply in JSON `{reply, plan:{title, park, stops:[{id,time,minutes,why}], tip}}`
    - The returned stops are checked against real places.
  - **Without the AI (or when it fails),** a keyword parser updates the survey and rebuilds the plan. It understands foods, shops and experiences (and negations like "no sushi"), "full day", "quick", driving, metro and "less walking". It replies "Got it: … Updated."

## 6. Legacy (`#legacy`)

- **Header.** A red **老舗** kanji, the title "Still here." and the lede "Family-run shops and restaurants that have kept Little Tokyo going for generations."
- **Stats band:** the number of legacy businesses, the oldest year with its name, and the count opened before 1960.
- **Featured oldest shop:** a 230px photo, a giant red year, "The oldest · N years", the name, a 3-line story and "See on the map →".
- **Decade jump bar.** It is sticky and has a button per decade ("1900s" …) plus **Favorites**, each scrolling smoothly to its section.
- **Timeline.** A red vertical line with a big dot and heading per decade, plus era notes for the 1900s, 1940s (return after WWII incarceration) and 1970s (JVP opens 1978). Each row shows:
  - a 76px thumbnail (greyscale if closed)
  - the year, and "N yrs" or "Closed"
  - the name, the type and a 2-line story
- **Long-time favorites.** A horizontal scroller of legacy places whose opening year isn't confirmed.
- Every item opens the place on the map.
- **Source:** the Little Tokyo Historical Society and Little Tokyo Service Center lists. There are 24 legacy places.

## 7. Account (`#account`)

- **Before joining.** The page shows "Join Little Tokyo · Save spots, keep plans, get the monthly letter." with big tiles **I'm visiting** and **I own a business**. A note says either "Saved on this phone for now." or "You'll be signed in with your account…" in cloud mode.
- **After joining:**
  - a type badge (Visitor or Business owner), "Synced to your account" or "Saved on this device", and **Switch type**
  - **Business owner:** a "Choose your business" select (all POIs), the business row, the owner wait box for restaurants, and "Business tools coming soon: Photos, hours, menus, a note to visitors. We check ownership first."
  - **Saved places** (open on the map), or "Tap Save on any place to keep it here."
  - **Saved plans:** title, date · N stops, "A → B → C", **Open** (loads it into Plan) and **Delete**
  - **Preferences:**
    - the chosen interests as chips
    - **Edit interests**, which jumps to survey step 2
    - **Reset**, which clears the survey and avoided places
    - **Appearance:** Match device / Light / Dark
  - **Newsletter** ("Once a month: openings, festivals, old shops."): an email form with validation and **Subscribe**, or "You're subscribed" with **Unsubscribe**
  - **Sign out**, which clears the account and saved places but keeps the newsletter record
- **Storage.** The account is stored as `lt-acct` (type, business, the last 12 plans, saved, prefs). In cloud mode it is mirrored to `data/users/{id}/profile`, with the newsletter at `newsletter/{id}`.

## 8. Host integrations (optional)

The original ran inside a host that exposed `window.claude.use(name)`. `src/lib/claude.ts` keeps that contract, and every feature degrades gracefully when the host is absent:

| capability | used for | fallback |
|---|---|---|
| `db` | live wait times (`waits` collection, `onSnapshot`; a post counts as live for 3h), cloud account, newsletter | device-only `localStorage`; owner box says "Owner tools aren't live yet" |
| `user` | `me()` (name, email, id), `can("data.write")` | device mode |
| `sample` | AI day-planner replies (`sample.json(turns)`) | offline keyword planner |
| `dictation` | voice input | browser `SpeechRecognition`, otherwise voice is disabled |

## 9. Data (`src/data/`, extracted from the original)

| file | contents |
|---|---|
| `geo.json` | bounds, buildings `{p, pk?}`, roads `{c: class, n: name, p}`, areas `{k: green/plaza/parking, p}`, walking graph `{n: nodes, e: [a,b,nameIdx], names}` |
| `positions.json` | x/y (metres) per place id, with source |
| `research.json` | per numbered place (keys "1"–"66", "metro"): status (49 open, 10 unknown, 1 temp closed, 1 moved, 6 closed), hours `{mon:"11:00-21:00", …}`, story, parking, sources… plus `park` rates for garages 31 and 34 |
| `logistics.json` | `parking[]` (rates, rateList, ratesShort, entrance, validation, hours, kind), `restrooms[]`, `mapP` (extra parking points), `meters` note |
| `waits.json` | 34 researched restaurant waits (16 with min/max minutes): peak, off-peak tip, reservations, basis, sources, confidence |
| `photos.json` | 75 Wikimedia/Flickr photos for 58 places, with author, license and source |
| `events.json` | 29 events (see section 4) |
| `images.json` | image key → `/images/<key>.jpg` (files in `public/images/`) |

Opening hours are evaluated in **America/Los_Angeles**. Ranges past midnight carry over into the next day, and a place with unknown hours counts as open for planning.

## 10. localStorage keys

`lt-theme`, `lt-iteration`, `lt-filter`, `lt-subs`, `lt-me3`, `lt-saved`, `lt-survey`, `lt-avoid`, `lt-plan`, `lt-chat`, `lt-acct`.

## 11. Known differences in the React rebuild

These are deliberate. Keep or revisit them on purpose.
- **Floating map buttons.** The 📍/🚻/🅿️/± buttons hide while the sheet is at half or full height, so they don't cover the search box. The sheet's own Parking and Restroom actions cover the same need.
- **Filter persistence.** `lt-filter` and `lt-subs` are written but not restored on load. This matches the original, which never read them back.
- **Opening the map from another view.** Doing this skips the map's intro fly-in, so the intro can't override the camera move to the place.
- **Events state.** Leaving the Events page resets its selected day, month and filter. The original kept all views mounted. The map stays mounted, so its camera and filters persist.
- **Visual design.** Everything is HeroUI components on HeroUI tokens (see Design). The Directions selects are HeroUI `Select`, toasts are HeroUI toasts, and the top menu is HeroUI `Tabs`.

## 12. Accessibility and motion

- **Labels.** Buttons have `aria-label`s (map controls, pins with the place name, clusters with "N places here, tap to zoom in"). Menu items set `aria-current`, chips and tiles set `aria-pressed`, and tabs use `role=tab` with `aria-selected`.
- **Hidden headings.** Screen-reader-only headings exist on the cover page and in the about panel.
- **Reduced motion.** `prefers-reduced-motion` turns off the stamp animation, camera fly animations, smooth scrolling and the spinner/pulse.
- **Keyboard and focus.** Hold-to-talk works from the keyboard, and the focus ring uses the accent colour.
