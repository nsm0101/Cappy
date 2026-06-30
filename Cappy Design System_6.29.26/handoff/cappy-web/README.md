# Cappy Design System → cappy-web

Drop-in, framework-free styling for the `cappy-web` Vite app (vanilla JS, multi-page,
Supabase auth). No build step, no React — just CSS custom properties and classes.

## Files in this bundle

```
cappy.css              ← the whole design system (tokens + base + components)
assets/cappy-mark.png  ← capybara head (transparent) — wordmark + NFC mark
assets/cappy-icon.png  ← square app icon (favicon / PWA)
demo.html              ← living reference of every component (open it locally)
```

## Install (2 steps)

1. **Copy** `cappy.css` and the `assets/` folder into the repo's `src/`:
   ```
   src/cappy.css
   src/assets/cappy-mark.png
   src/assets/cappy-icon.png
   ```
   You can keep the existing `src/styles.css` or delete it — `cappy.css` already
   restyles the bare `button`, `input`, `.card`, `.row`, and `.badge` you use today,
   so existing pages get the new look with zero markup changes.

2. **Link it** in each page's `<head>` (login, app, scan). Because Vite serves with
   `base: "/cappy/"`, use a root-absolute path so it resolves in dev and on Pages:
   ```html
   <link rel="stylesheet" href="/cappy/src/cappy.css">
   ```
   > In local `vite dev` the base is also `/cappy/`, so the same path works.
   > If you prefer, `import './cappy.css'` from a JS entry and let Vite fingerprint it.

## Dark mode

Add `data-theme="dark"` to `<html>` (or `class="dark"`). Everything re-themes from
tokens — no per-component work. To follow the OS automatically:
```js
if (matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.setAttribute('data-theme','dark');
```

## The pieces you'll use most

| Need | Markup |
|---|---|
| Button | `<button class="cap-btn">` · `--blue` `--secondary` `--ghost` `--block` `--lg` |
| Text field | `<label class="cap-field"><span class="cap-field__label">…</span><input></label>` |
| Card | `<div class="cap-card">` (`--inset` tinted) |
| **Dose status** | `<span class="dose-pill dose-pill--due">Due now</span>` — `due` / `early` / `recent` / `overdue` |
| Safety line | `<p class="dose-safety">…</p>` |
| Avatar | `<span class="cap-avatar" style="--tint:var(--blue-500)">AM</span>` (drop an `<img>` inside for a photo) |
| List row | `<button class="cap-row-item">… avatar · title/sub · pill …</button>` |
| Segmented | `<div class="cap-segmented"><button class="is-active">…</button>…</div>` |
| Tab bar | `<nav class="cap-tabbar"><a class="is-active">…</a>…</nav>` |
| **Dose pop-up** | `.cap-scrim` > `.cap-sheet` — toggle `.is-open` on the scrim |
| NFC target | `<div class="cap-nfc"><img src="…/cappy-mark.png"></div>` |
| Wordmark | `<span class="cap-wordmark"><img src="…/cappy-mark.png">Cappy!</span>` |

## The dosing dashboard pop-up (centerpiece)

```html
<div class="cap-scrim" id="doseSheet">
  <div class="cap-sheet" role="dialog" aria-modal="true" aria-label="Log a dose">
    <div class="cap-sheet__grabber"></div>
    <!-- child header, suggested dose, dose-pill + safety line, actions -->
  </div>
</div>
```
```js
const s = document.getElementById('doseSheet');
function openDose(){ s.classList.add('is-open'); }
function closeDose(){ s.classList.remove('is-open'); }
s.addEventListener('click', e => { if (e.target === s) closeDose(); });
```
Add `cap-scrim--center` for a centered confirmation modal instead of a bottom sheet.
This is what your `/cappy/scan/` flow opens after an NFC tap → pick child → log dose.

## Applying it to the current pages

- **`/cappy/login/`** — wrap the form in `.cap-card`, use `.cap-field` for the email
  input, `.cap-btn--block` for "Send magic link", and the `.cap-wordmark` lockup at top.
- **`/cappy/app/`** — `.cap-app` container, a child list of `.cap-row-item`s (each with
  a `.dose-pill` showing status), and a `.cap-tabbar` at the bottom.
- **`/cappy/scan/`** — `.cap-nfc` tap target while reading, then open the `.cap-sheet`
  dose pop-up on success.

## Design intent (so it stays on-brand)

- **Teal `--brand` (#18A78D)** is primary; **capybara-blue `--accent-2` (#1E6FC4)** is the
  Cappy accent — use it for the dose/log call-to-action so logging feels distinct.
- **Dose colors are guidance, not clinical certainty.** Always pair a `dose-pill` with a
  `.dose-safety` line. Never present timing as a medical guarantee.
- Type: **Nunito Sans** (display/numerals), **Inter** (UI), **DM Mono** (units like "mL"),
  **Baloo 2** (the playful "Cappy!" wordmark only).
- Min tap target is 44px (`--tap-min`) — already baked into buttons, rows, inputs.

Open `demo.html` in a browser to see and copy any pattern.
