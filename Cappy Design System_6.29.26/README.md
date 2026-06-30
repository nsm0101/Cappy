# CloseDose + Cappy Design System

A design system for **CloseDose** — a pediatric medication dosing companion that helps parents (and any caregiver) confirm safe over-the-counter doses for kids, day or night — and for **Cappy**, its family medication-coordination companion app (the future Swift iOS / Android product).

> **Two products, one family.** CloseDose is the dose-lookup brand (teal, warm, leaning playful — a chalk-drawn childlike direction is planned for the marketing site). **Cappy** is the logging + coordination app: same teal story, but **a notch more professional and reassuring** so parents trust it for real-time, multi-caregiver dose tracking. Cappy adds a **capybara-blue** secondary accent (from the mascot), a **dose-safety status system**, **NFC-tap** tokens, and a **mobile-native** sizing layer. Everything Cappy-specific lives in `cappy-tokens.css`; load `styles.css` to get both layers at once.

---

## Product context

CloseDose lives at **closedose.com**. The product helps parents look up dosing information for common OTC medications for generally healthy children. The product is used:

- **By parents and caregivers** first and foremost — sleepy, anxious, often in the middle of the night
- **Bedside and on-the-go** — phone in hand, kid in arms
- **In dark and light environments** — dark mode is a first-class concern, not an afterthought
- **By adults too** — shared household use means the product has to feel grown-up enough not to embarrass anyone

The product voice has to do something hard simultaneously: be **calming, simple, and warm enough for a panicked 3am parent**, while **rigorous, professional, and conservative enough that an adult shares it without hesitation**. Pediatric without being childish.

> "Always confirm dosing before administering medication. CloseDose was created with the intention of providing dosing information of common over-the-counter medications for generally healthy children." — closedose.com

## Design influences

- **closedose.com** — the existing product. Teal color story. Dark-mode aware.
- **pomegranate.health** — inspiration only (do not copy). Borrowed: stacked-card layered compositions, soft pastel grounds with one bright accent, oversized friendly type, the sense of a "warm health app." Pomegranate is pink/coral; CloseDose stays in the teal/green family.

## Sources consulted

| Source | URL | Notes |
| --- | --- | --- |
| CloseDose live site | https://closedose.com | Production product. Teal palette, OTC dose lookup. |
| Pomegranate Health | https://pomegranate.health | Layout / mood inspiration only. Stacked phone screens, big rounded type, soft cream/pink grounds. |

> ⚠️ Codebase access: not provided. The system below is built from the public site, the brief, and the inspiration link. **Please attach the codebase / Figma when available** so we can lock pixel-perfect tokens.

---

## Index

| File / folder | What it is |
| --- | --- |
| `README.md` | This file. Brand context + content + visual + iconography fundamentals. |
| `colors_and_type.css` | All color and typography tokens (light + dark), as CSS custom properties. |
| `fonts/` | Webfont files used by the system. |
| `assets/` | Logos, marks, and brand imagery. |
| `preview/` | Small HTML cards that populate the Design System review tab. |
| `components/` | Importable compiled React components (`DoseStatusPill`), each with a `.d.ts`, `.jsx`, and `@dsCard` preview. |
| `ui_kits/web/` | UI kit recreating the marketing site + dose-lookup flow. |
| `ui_kits/app/` | UI kit recreating the mobile dose-lookup app screens. |
| `SKILL.md` | Cross-compatible Skill manifest for using this system in Claude Code. |

---

## Content fundamentals

CloseDose copy is **calm, plainspoken, and parental**. It reads like a thoughtful pediatrician explaining something to you at the kitchen counter — not a chatbot, not a children's book, not a pharmaceutical insert.

**Voice characteristics**

- **Plain English.** "How much should I give?" not "Determine the appropriate dose."
- **Second person, warm.** "You" the caregiver. The patient is "your child" or "your kid" — never "the patient," never "baby" (too saccharine for shared adult use).
- **Sentence case everywhere.** Headlines, buttons, nav. Title Case feels stiff; SHOUTING feels alarming. The only ALL CAPS we use is on a single warning label or on a section eyebrow tag (`SAFETY`).
- **Active, present tense.** "Confirm with your pediatrician." Not "It is recommended that one confirms…"
- **Numbers as numerals** when they are doses, weights, ages, or times. "5 mL", "ages 2–11", "every 4 hours". Not "five milliliters."
- **Units always spelled or abbreviated consistently** — `mL`, `mg`, `kg`, `lb`, `°F`. Never mixing styles.
- **No jargon without a plain-English gloss.** "Acetaminophen (Tylenol)". Generic name first, brand in parens.
- **Reassuring, never panicked.** Errors say "Let's double-check that weight" — not "Invalid input."

**Tone examples**

| Don't | Do |
| --- | --- |
| INVALID WEIGHT ENTRY | That weight looks off — can you check? |
| Please consult a healthcare professional regarding the appropriate dosage. | Always confirm with your pediatrician before giving medication. |
| Welcome to CloseDose! 🎉 | Hi. Let's find the right dose. |
| 5 ml of children's tylenol | 5 mL of children's Tylenol (acetaminophen) |

**Disclaimer/safety language** is mandatory and never softened. Every dose result carries: *"Always confirm dosing before administering medication."* Verbatim. This is non-negotiable copy.

**Emoji**: not in product. Allowed in marketing illustration captions sparingly (a single 🌙 for night-mode messaging, a 🍼 in a "for babies" eyebrow). Never inside dose data, never inside buttons, never as bullets.

**Casing summary**

- **Sentence case**: headlines, buttons, nav, modal titles
- **lowercase**: nothing (we don't do faux-humble all-lowercase)
- **ALL CAPS**: single-word eyebrow tags (`SAFETY`, `NEW`), tracked +0.08em
- **Title Case**: only proper nouns and drug brand names (Tylenol, Motrin, CloseDose itself)

---

## Visual foundations

The visual system is built around three ideas: **a deep, calm teal that reads as both medical and bedtime**, **soft mint and cream grounds** that let cards float, and **stacked, layered cards** as the central compositional motif.

### Color

The palette is led by **Teal 500 (`#18A78D`) — the official brand teal, sampled from the CloseDose app icon**. It's the action color, the link color, the brand mark color. Around it sits a cool-leaning neutral ramp (slates with a faint teal undertone) and a warm cream surface (`#FBF8F2`) for the marketing site, with mint (`#E8F5F1`) and seafoam (`#D6EFE8`) as soft surface tints.

- **Primary action**: Teal 500 (`#18A78D`)
- **Brand accent**: Teal 600 (`#128873`) for hover, Teal 700 (`#0E6D5C`) for press
- **Soft accent**: Mint 200 (`#C7E9DD`) for chips, badges, low-emphasis surfaces
- **Warning**: Amber 600 (`#D97A0E`) — used sparingly, for "check your dose" reminders, never for errors
- **Error**: Coral 600 (`#D84A4A`) — desaturated, never pure red. Pediatric ≠ alarming.
- **Success**: Sage 600 (`#2E9E6E`) — confirmations
- **Surfaces (light)**: cream (`#FBF8F2`) page → white (`#FFFFFF`) card → off-white (`#F4EFE5`) inset
- **Surfaces (dark)**: deep teal-black (`#0B1717`) page → slate-teal (`#13201F`) card → slate (`#1A2A29`) inset. Dark mode is **warm-dark, not pure black** — it has to be readable at 3am without scorching the eyes.

Full tokens in `colors_and_type.css`.

### Type

- **Display & headlines**: **Nunito Sans** (variable sans, weight 700–800). Rounded terminals echo the friendly app icon. Warm and parental without tipping childish. Used for hero copy, section headers, dose numerals.
- **UI & body**: **Inter** (variable sans). Neutral and trustworthy, sharp legibility for product chrome and form fields.
- **Numbers in dose results**: **Nunito Sans 700** at large sizes (the dose feels considered and warm); **Inter tabular-nums** in dense tables.
- **Mono / units**: **DM Mono** for unit labels (`mL`, `mg`, `kg`), timestamps, and any data chips.

Type scale uses a 1.250 (major third) ratio at body and below, jumping to 1.5 for display. Line-height is generous: 1.6 for body, 1.15 for display.

All three are loaded from Google Fonts in `colors_and_type.css`. **If CloseDose ships with different brand fonts in production, please share them** and I'll swap them in.

### Spacing

A 4-pt grid. Tokens: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96. Cards prefer 24–32 internal padding; sections prefer 64–96 vertical rhythm.

### Backgrounds

- **No full-bleed photography** in app surfaces. Photography belongs to marketing only and is warm, naturally lit, family/parent imagery — soft skin tones, no clinical hospital stock.
- **No noisy textures**. The only background "texture" is a very faint vertical gradient (teal 50 → cream) on hero sections, optional.
- **No hand-drawn illustrations.** This is a health product; we stay grounded.
- **Soft radial wash** behind the hero phone stack: a ~600px blurred mint disc, 40% opacity, set behind cards.

### Animation

Subtle, never bouncy. The product is for tired parents — energy is offensive.

- **Standard duration**: 200ms (`--motion-fast`), 320ms (`--motion-base`), 480ms (`--motion-slow`)
- **Easing**: `cubic-bezier(0.2, 0, 0, 1)` — a calm, asymmetric ease-out. Tokenized as `--ease-out-soft`.
- **Card entrance**: 12px translate-y + fade, 320ms, staggered 60ms when cards appear in a list.
- **Hover**: surface darkens 4% OR shadow grows from level-1 to level-2. Never both.
- **Press**: 0.98 scale, 120ms, snap back on release.
- **No bounces, no springs, no parallax.** A dose calculator is not a game.

### Hover & press

- **Buttons**: hover darkens fill by ~6% (Teal 600 → Teal 700). Press scales to 0.98. Focus ring is 2px Teal 500 with 4px white halo.
- **Cards**: hover lifts shadow (level-1 → level-2) and translates -2px. Press settles back to level-1. Cursor is `pointer`.
- **Links**: hover changes color (Teal 600 → Teal 700) AND underlines (ink decoration `underline-offset: 3px`).

### Borders & shadows

Cards are the primary container. Two shadow systems coexist:

- **Soft shadow (default)**: `0 1px 2px rgba(11,30,29,0.04), 0 8px 24px -8px rgba(11,30,29,0.10)` — warm, low-contrast, ambient.
- **Crisp shadow (dark mode + emphasized cards)**: `0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 32px -12px rgba(0,0,0,0.5)` — defined edges, pop without glare.

Borders are **1px hairlines** (`rgba(11,30,29,0.08)` light / `rgba(255,255,255,0.06)` dark), used in addition to shadow on cards for dark-mode definition. No 2px+ borders anywhere except focus rings.

### Corner radii

- **4** — chips, micro tags
- **8** — inputs, small buttons, secondary cards
- **12** — primary buttons
- **16** — cards (the default)
- **24** — hero/feature cards, modals
- **999px** — pills

### Cards (the central motif)

Cards are the heart of CloseDose. From the inspiration:

- Cards stack and overlap with a slight rotation (-2°/+2°) on marketing hero compositions, like a small fan of phones or features
- Inside the product, cards are flat (no overlap), but they layer: a parent card may contain child cards with the inset surface color
- All cards: 16px radius default, hairline border + soft shadow, 24px padding minimum
- Marketing hero cards: 24px radius, generous padding (32–40px)

### Transparency & blur

- **Blur is rare.** A 16px backdrop-blur on the sticky header when content scrolls beneath it. Nothing else.
- **Transparency** is used in tints (Mint 200 at 60% over cream) and in shadow fills, never in primary surfaces.

### Imagery vibe

- **Warm and naturally lit.** Hands-with-medicine, parent-and-child, kitchen-counter scenes. Never hospital corridors.
- **Skin tones look real.** No over-saturation, no green tint, no clinical cool grade.
- **Slight warmth grade overall.** +5 warmth, -5 saturation in spirit.
- **No b&w, no grain.**

### Layout rules

- **Marketing**: 1200px container max, 24px gutters on mobile, centered. Hero is asymmetric: text left, stacked phones right, slight overlap.
- **App**: full-bleed cards, 16px page gutters, sticky bottom CTA on dose-result screens.
- **Sticky elements**: app top nav (with backdrop-blur), bottom CTA bar on result screens. Marketing has a transparent-to-solid sticky header.
- **No fixed sidebars** in app. Tabs live at bottom (it's mobile-first).

---

## Iconography

CloseDose uses **Lucide** as the primary icon set — clean, friendly, 1.75px stroke, rounded line-caps. Lucide reads as both medical-credible and warm; it's the right register for a parent product.

- **Stroke**: 1.75px (Lucide default); never mix weights
- **Size grid**: 16, 20, 24, 32, 48 — pick one per context, do not interpolate
- **Color**: inherits `currentColor`. In default product chrome, icons use Slate 600. When inside a Teal pill or button, they use the contrast color.
- **Pediatric icons**: `baby`, `heart-pulse`, `pill`, `clock`, `moon`, `droplet`, `weight`, `thermometer`, `syringe` — these are the workhorses
- **No emoji in product UI.** A single `🌙` glyph may appear in marketing copy for night-mode messaging.
- **No unicode dingbats.** No ▸, ➜, ✓ — we use Lucide's `chevron-right`, `arrow-right`, `check`.

> ⚠️ Substitution flag: Lucide is used as the icon system here because the codebase wasn't available. **If CloseDose ships with a different icon set in production, please share** and I'll swap.

### Logos & marks

- **Wordmark**: "closedose" set in Fraunces SemiBold, 96 weight. The "o"s are dot-anchored — see logo SVG.
- **Mark**: a stylized teal droplet enclosing a soft "cd" monogram. Used as favicon and app icon.
- See `assets/` for SVGs.

---

## Accessibility

- All text/background combinations in `colors_and_type.css` clear WCAG AA at body sizes; AAA where possible at large display.
- Dark mode is fully tokenized — every surface and ink color has a `--dark-` counterpart.
- Focus rings are visible (2px Teal 500 + 4px halo) on every interactive element.
- Tap targets minimum 44×44px in app contexts.
- Numeric inputs use `inputmode="decimal"` and tabular figures.

---

## Cappy — the family coordination app

Cappy is the mobile companion where a **family** logs and coordinates real medication doses across multiple caregivers and multiple kids. Where CloseDose answers *"how much?"*, Cappy answers *"did anyone already give it, and is it safe to give now?"* — in real time, often passed phone-to-phone between two tired parents.

**Positioning vs. CloseDose:** same teal DNA, but Cappy dials *up* trust and polish and dials *down* whimsy. The capybara mascot is the warmth budget — it appears at the edges (app icon, loading, empty states, onboarding, a single celebratory beat when a dose is logged) and **never inside live dose data**. The dosing surfaces themselves stay clinical-calm and legible.

### What's in the Cappy layer

| File | What it adds |
| --- | --- |
| `styles.css` | **Single entry point.** Imports the CloseDose base then the Cappy layer. Consumers link this. |
| `cappy-tokens.css` | Capybara-blue ramp, capybara-tan warmth, the dose-safety status system, NFC-tap tokens, sheet/scrim + mobile sizing. Light + dark. |
| `templates/` | Seven copy-and-go starting screens (see below), each a `.dc.html` Design Component. |
| `components/` | Importable, compiled React components (e.g. `DoseStatusPill`) consumers mount via `window.CloseDoseDesignSystem_019dff`. |
| `assets/cappy-*`, `assets/app-icon.png` | Mascot mark, app icon, monochrome marks. |
| `preview/cappy-*.html` | Design-system review cards for the Cappy brand, color, avatars, dose-status, med identity, timeline/caregivers. |

### Cappy color additions

Led by the same **Teal 500 (`#18A78D`)** for primary actions. Cappy adds:

- **Capybara Blue** (`--blue-500: #1E6FC4`) — secondary accent, sampled from the mascot's ground. Used for the NFC tap affordance, "given recently" status, links to coordination/family features, and accent buttons. Hover `--blue-600`, press `--blue-700`. In dark mode it lifts to `#4D93DD`.
- **Capybara Tan** (`--tan-500: #C29A66`) — warmth only: mascot fur, friendly default avatar grounds. Never an action color.
- Semantic aliases: `--accent-2`, `--accent-2-hover/press/tint/fg`.

### Cappy logo & wordmark

The Cappy mark is the **capybara face badge** (teal ring → white gap → blue ground), used as the app icon, launch mark, and avatar default. The horizontal lockup pairs that badge with the **"Cappy!"** wordmark set in **Baloo 2 (800)** — a rounded display face that reads playful but stays polished. The wordmark is teal (`#128873`) on light surfaces, white on teal/ink. See the `Brand — Logo` and `Brand — Mark & Wordmark` cards.

### Dose-safety status system (the heart of Cappy)

Four states tell a caregiver, at a glance, whether a dose may be given — **color reinforces safe-vs-too-early without implying clinical certainty.** Each has `solid` / `fg` / `bg` / `ring` tokens, tuned separately for light and warm-dark:

| State | Token prefix | Color | Means |
| --- | --- | --- | --- |
| **Due now** | `--dose-due-*` | calm teal | Enough time has passed; a dose may be given |
| **Too early** | `--dose-early-*` | amber caution | Too soon for another dose; wait |
| **Given recently** | `--dose-recent-*` | capybara blue | A dose was just logged; informational |
| **Window passed** | `--dose-overdue-*` | soft coral | An expected/scheduled dose window has passed |

Every status surface **must carry the safety line** — *"Always confirm dosing before administering medication."* — verbatim, same as CloseDose. Status color never replaces that text; it sits alongside it.

### NFC & the pop-up dosing dashboard

Cappy's flagship interaction: a caregiver **taps an NFC tag** (on the medicine bottle / cabinet) and Cappy surfaces a **card-style pop-up sheet** — the real-time dosing dashboard — to log a dose for a chosen family member.

- **NFC tokens**: `--nfc-core` (the pulsing center), `--nfc-glow`, `--nfc-ring` — drive the tap-to-scan affordance and its concentric pulse.
- **Sheet tokens**: `--scrim` (dim the screen behind), `--sheet-radius` (28px top corners), `--sheet-grabber` (the drag handle). Pop-ups are **bottom sheets** on mobile: scrim → rounded sheet → grabber → content. They animate up with the calm `--ease-out-soft`, never a spring.
- **Flow**: NFC tap → quick-access sheet (med is known from the tag → **pick child**) → dosing dashboard (status banner + weight + dosing-window gauge + confirm) → celebratory confirmation. The dashboard shows the selected child's status using the dose-safety tokens above and lets the dose be logged in one tap.

### Mobile-native layer

Cappy is built mobile-first for the Swift/Android port. Tokens: `--tap-min: 44px` (every hit target), `--screen-gutter: 20px`, `--tabbar-h: 84px`. Controls feel **custom-branded but platform-comfortable** — not faux-iOS, not Material, but legible and tappable on both. Cards stay flat inside the app (no marketing-style overlap/rotation).

### Children & family

- **Child identity**: photo avatars with a **colored monogram fallback** (initials on a tinted disc, one stable color per child). The capybara/tan avatar set is an optional playful default.
- **Family & caregivers**: roles and permissions are explicit (who can see / log for which child). Coordination features lean on the capybara-blue accent to distinguish them from clinical dose surfaces.
- **Medications**: both OTC and prescription; each med carries a stable identity color used consistently across timeline, profile, and the dose pop-up.

### Cappy templates (`templates/`)

Seven ready starting screens, each a Design Component (`.dc.html`) consumers can copy. All are mobile-framed, light + dark aware, and built on the tokens above:

| Template | Screen |
| --- | --- |
| `dose-log-popup` | **Flagship** NFC-triggered dosing dashboard pop-up (2 layout variations) |
| `nfc-quick-access` | Post-tap quick-access sheet (med known → pick child) |
| `child-profile` | Child profile: weight, last dose, medication list, recent timeline |
| `med-timeline` | Shared medication history across caregivers |
| `family-management` | Family & caregiver roles, invites, permissions |
| `home-dashboard` | Home: kids at a glance, what's due, recent activity |
| `onboarding` | Welcome / add-family onboarding flow |

> Style holes (`{{ }}`) in these templates carry **genuinely dynamic** values — the selected child's status color, per-medication identity colors in lists, per-event timeline colors. They are data-driven, not theme tokens, and are the intended exception to the "literal styles" rule.

### Cappy components (`components/`)

Importable, compiled React components for production prototypes (the Swift-bound app's React layer). Each lives in its own folder with a `<Name>.jsx` (the `export function`), a `<Name>.d.ts` (typed props), and an `@dsCard` preview. Consumers load the bundle and read the namespace:

```html
<script src="…/_ds_bundle.js"></script>
<script>
  const { DoseStatusPill } = window.CloseDoseDesignSystem_019dff;
</script>
```

| Component | What it is |
| --- | --- |
| `DoseStatusPill` | The signature dose-safety chip — `due` / `early` / `recent` / `overdue`, `sm`/`md` sizes. Color reinforces safe-vs-too-early; always pair with the safety line. |
| `ChildAvatar` | Child & caregiver identity disc — photo or colored-monogram fallback, identity colors, optional caregiver role ring + corner badge. |

More primitives (med-identity tile, dosing-window gauge) can be promoted from the templates on request.

### Cappy mascot usage

The capybara shows up **only** at: app icon / launch, loading & sync states, empty states (no kids / no doses yet), onboarding welcome moments, and one celebratory micro-beat when a dose is logged. **Never** inside live dose numbers, status banners, or the medication timeline — those stay calm and professional.

---

## Open questions / asks

1. **Codebase / Figma**: please share so we can lock real tokens.
2. **Real fonts**: confirm Fraunces + Inter or send the production stack.
3. **Real logo files**: SVGs of the wordmark + app mark in production form.
4. **Photography**: any approved campaign imagery to seed the marketing kit.
5. **Dose data structure**: how doses are modeled (mg/kg, range vs single, age/weight gates) — needed to make the result component truly accurate.
