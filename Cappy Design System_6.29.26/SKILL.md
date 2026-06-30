---
name: closedose-design
description: Use this skill to generate well-branded interfaces and assets for CloseDose (pediatric OTC dose-lookup brand) and Cappy (its family medication-coordination app — teal + capybara-blue, dose-safety status, NFC pop-up dosing dashboard). Contains essential design guidelines, colors, type, fonts, assets, dose-status tokens, and copy-and-go app templates.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files. **CloseDose** is the dose-lookup brand; **Cappy** is the family-coordination app built on the same teal system with its own additions (read the "Cappy" section of the README).

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick map
- `styles.css` — **single entry point**: imports the CloseDose base + the Cappy layer. Link this to get every token.
- `colors_and_type.css` — CloseDose base color + type tokens (light + dark)
- `cappy-tokens.css` — Cappy layer: capybara-blue accent, capybara-tan, dose-safety status, NFC + sheet tokens, mobile sizing
- `assets/` — logos + marks (CloseDose) and `cappy-*` / `app-icon.png` (Cappy mascot + app icon)
- `templates/` — seven copy-and-go Cappy app screens (dose pop-up, NFC quick-access, child profile, timeline, family, home, onboarding)
- `ui_kits/app/` — mobile dose-lookup recreation (HomeScreen, DoseScreen, TabBar, MedCard, KidPill, Icon)
- `ui_kits/web/` — marketing site recreation (Header, Hero, StackedCards, FeatureGrid, CTA, Footer)
- `preview/` — token-card examples (incl. `cappy-*` cards) to crib from

## Voice cheat sheet
- Sentence case everywhere; no Title Case
- Plain English: "Find the right dose" not "Determine the appropriate dosage"
- Numerals for doses, weights, ages, times
- Errors are warm: "That weight looks off — can you check?"
- Always include the safety line on dose results: *"Always confirm dosing before administering medication."*
- No emoji in product UI

## Visual cheat sheet
- Brand teal `#18A78D` (Teal 500, sampled from app icon); hover Teal 600; press Teal 700
- **Cappy** accent: capybara blue `#1E6FC4` (Teal stays primary; blue is secondary — NFC, "given recently", coordination)
- Cream `#FBF8F2` page; white cards; mint `#E8F5F1` tints
- Dark mode is warm-dark: `#0B1717` page, never pure black
- Type: Nunito Sans 700/800 (display + dose numerals), Inter (UI/body), DM Mono (unit labels)
- Cards: 16px radius, hairline border, soft shadow, 24px padding
- Motion: 320ms `cubic-bezier(0.2,0,0,1)`, no bounces
- Icons: Lucide, 1.75px stroke

## Cappy cheat sheet
- **Dose-safety status** (always beside the safety line, never replacing it): Due now = teal (`--dose-due-*`), Too early = amber (`--dose-early-*`), Given recently = capybara blue (`--dose-recent-*`), Window passed = soft coral (`--dose-overdue-*`)
- **NFC pop-up**: bottom sheet — `--scrim` dim → `--sheet-radius` 28px → `--sheet-grabber` handle → content; pulse uses `--nfc-core/glow/ring`. Flow: tap → pick child → dosing dashboard → confirm → one celebratory beat.
- **Mobile-native**: `--tap-min` 44px, `--screen-gutter` 20px, `--tabbar-h` 84px. Custom-branded, comfortable on iOS & Android (not faux-iOS).
- **Mascot**: app icon, loading, empty states, onboarding, single dose-logged celebration only — never inside live dose data.
- **Kids**: photo avatar with colored-monogram fallback (one stable color each). Meds carry a stable identity color across all screens.
- **Positioning**: Cappy = more professional/reassuring than CloseDose; warmth lives at the edges (mascot), dose surfaces stay calm and legible.
- Start from `templates/` for any Cappy screen.
