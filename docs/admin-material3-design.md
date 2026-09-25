# GDG CTU Admin — Material 3 Design Spec

**Status:** Authoritative for all admin work (`/admin/*`). Public site is unaffected.
**Version:** 1.0 — 2026-09-25
**Owners:** design system (this file), implementation tracked in GitHub issues.
**Related files:** `frontend/src/components/admin/AdminShell.jsx`, `frontend/src/admin/editorial.js`, `frontend/src/App.jsx`, `frontend/src/index.css`, `frontend/src/styles/admin.css`, `frontend/src/styles/form-shell.css`, `frontend/src/components/ui/*`

---

## 1. Version policy

### 1.1 What this spec is based on
- **Baseline:** Material 3 for web as documented at [m3.material.io](https://m3.material.io) and [material.io/blog/introducing-m3-expressive](https://material.io/blog/introducing-m3-expressive) as of **2026-09-25**.
- **Expressive is non-normative.** Material 3 Expressive is treated as inspiration only. No Expressive-only tokens, shapes, or motion are required.
- **Reference code only:** [@material/web 2.5.0](https://github.com/material-components/material-web) and [@material/material-color-utilities / tokens 34.0.21](https://github.com/material-components/material-web/releases) are used as a reference for token names and math. **No new dependency is added.** The admin remains on the current hybrid stack: Tailwind v4 + plain CSS + shadcn primitives.
- If Material 3 web guidance changes after 2026-09-25, this file must be amended explicitly. Do not drift tokens by copying newer upstream values without a spec update.

### 1.2 How to update the spec
1. Open a `docs:` PR that bumps the header date and the "Based on" section.
2. List changed token values in the PR description with before/after.
3. Land the spec update in the same PR as (or before) the CSS update, so CI can diff `--md-sys-*` values against this document.

### 1.3 Reference URLs
- Foundations: https://m3.material.io/foundations
- Color roles: https://m3.material.io/styles/color/roles
- Typescale: https://m3.material.io/styles/typography/type-scale-tokens
- Shape: https://m3.material.io/styles/shape/shape-scale-tokens
- Elevation: https://m3.material.io/styles/elevation/overview
- Motion: https://m3.material.io/styles/motion/overview and https://m3.material.io/styles/motion/easing-and-duration/tokens-specs
- Navigation drawer / rail: https://m3.material.io/components/navigation-drawer/overview and https://m3.material.io/components/navigation-rail/overview
- How M3 adapts: https://m3.material.io/foundations/layout/understanding-layout/overview

---

## 2. Foundations

All admin UI uses **semantic roles**, never raw hex outside token definitions. Raw `rgba()` or `#0A4EB8` in component CSS is a bug.

### 2.1 Color — semantic roles only

#### Roles in use
| Role | Purpose | Notes |
|------|---------|-------|
| `primary` / `on-primary` / `primary-container` / `on-primary-container` | Main actions, selection, focus | Filled button uses `primary` + `on-primary` |
| `secondary` / `on-secondary` / `secondary-container` / `on-secondary-container` | Published state, tonal buttons | Published badge = `secondary-container` |
| `tertiary` / `on-tertiary` / `tertiary-container` / `on-tertiary-container` | Warning state | Warning badge = `tertiary-container` |
| `error` / `on-error` / `error-container` / `on-error-container` | Destructive, error state | Error badge = `error-container`; destructive confirm uses `error` |
| `surface` / `on-surface` / `surface-variant` / `on-surface-variant` | Page, card, and text | Body text = `on-surface` |
| `surface-container-low` | Page background under cards | Lighter than surface |
| `surface-container` | Table header | - |
| `surface-container-high` | Card and app bar | - |
| `surface-container-highest` | Selected row, raised surfaces | - |
| `outline` / `outline-variant` | Borders, dividers | Table container uses `outline-variant` |
| `scrim` | Modal dim | 32% on-surface for drawer/dialog scrim |
| `inverse-surface` / `inverse-on-surface` / `inverse-primary` | Snackbar | - |

No other color roles are introduced without a spec amendment.

#### State-layer opacities
Applied as an overlay on the component's own color, not by changing the color value.

| State | Opacity |
|-------|---------|
| Hover | 0.08 |
| Focus (state layer) | 0.10 |
| Pressed | 0.10 |
| Dragged | 0.16 |
| Disabled container / content | 0.12 / 0.38 |

#### Focus indicator
Separate from the state layer. A 3px solid `primary` outline offset by 2px. Never rely on `outline: none` without replacing it.

#### Light and dark scheme
Tokens live in `frontend/src/index.css`. Light scheme at `:root` (around line 748-812), dark scheme under `.dark` (around line 814-847). Component code never branches on light/dark; it reads the role token and the `.dark` class flips the value. Missing `ThemeProvider` or toggle is a gap to close (see §9).

### 2.2 Typography — one font system

#### Decision
The codebase currently mixes `Roboto + Google Sans`, `Google-Sans-Flex`, and `Archivo` references. This spec consolidates to one system:

- **Display / Headline / Title → Google Sans Flex** (variable)
- **Body / Label → Roboto Flex** (variable)

Fallback stacks: `Google Sans Flex, Google Sans, Roboto, sans-serif` for display roles; `Roboto Flex, Roboto, sans-serif` for body/label. No other display font is used in admin.

Weights: 400 regular, 500 medium for labels and medium titles. No 300 light in admin UI.

#### Typescale mapping
Values are Material 3 default (no custom tracking compression). Line heights are unitless or `rem` as listed.

| Role | Size / Line / Weight | Admin use |
|------|----------------------|-----------|
| `display-large` | 57 / 64 / 400 | Not used in admin (marketing only) |
| `display-medium` | 45 / 52 / 400 | Not used in admin |
| `display-small` | 36 / 44 / 400 | Not used in admin |
| `headline-large` | 32 / 40 / 400 | Large empty states only |
| `headline-medium` | 28 / 36 / 400 | Auth page title |
| `headline-small` | 24 / 32 / 400 | **Page title** (every admin page `h1`) |
| `title-large` | 22 / 28 / 400 | Card title, dialog title |
| `title-medium` | 16 / 24 / 500 | Card subtitle, section heading |
| `title-small` | 14 / 20 / 500 | **Table header**, filter label, overline |
| `body-large` | 16 / 24 / 400 | Form input text, dialog body |
| `body-medium` | 14 / 20 / 400 | **Table body**, helper text, card body |
| `body-small` | 12 / 16 / 400 | Captions, helper under fields |
| `label-large` | 14 / 20 / 500 | **Button label**, form label, tab label |
| `label-medium` | 12 / 16 / 500 | **Rail label**, chip label, pagination label |
| `label-small` | 11 / 16 / 500 | Tag, timestamp |

Rules:
- Page title is always `headline-small`. Never `display-*`.
- Table header is `title-small` (14/500), never uppercase. Uppercase transforms are not used in admin.
- Table body is `body-medium` (14/400).
- Button and form labels are `label-large` (14/500). Rail labels are `label-medium` (12/500).
- Do not introduce custom `text-[13px]` or `font-[650]` in admin CSS.

### 2.3 Shape — corner radius scale

| Token | Radius | Admin use |
|-------|--------|-----------|
| `none` | 0 | Dividers, rail indicator rect |
| `extra-small` | 4px | **Table container, text fields, menus** |
| `small` | 8px | Chips, small cards, filter dropdowns |
| `medium` | 12px | **Cards**, supporting pane |
| `large` | 16px | **Buttons (pill-adjacent)** — M3 large maps to 16px |
| `extra-large` | 28px | **Dialogs** |
| `full` | 9999px | Pills, FAB, icon buttons (circular) |

- Buttons are `full` (pill) when using `components/ui/button.tsx` as remapped to M3, otherwise `large` (16px) for form-shell buttons. The two must not mix on the same page; prefer the pill button going forward.
- Table container is `extra-small` (4px), not the current 12px.

### 2.4 Elevation

| Level | `shadow` | Admin use |
|-------|----------|-----------|
| 0 | none | **Tables, cards, app bars** (flat) |
| 1 | 1dp | **Drawer (standard)**, top bar when scrolled |
| 3 | 3dp | **Dialogs**, dropdowns, supporting pane overlay <840px |
| 6 / 8 / 12 | - | Not used in admin (reserved) |

No card or table has a drop shadow at rest. Shadows appear only on drawer (level 1) and modal surfaces (level 3).

### 2.5 Motion

- **Easing:** `cubic-bezier(0.2, 0, 0, 1)` (M3 standard / `emphasized` easing). No `ease-in-out` in admin chrome.
- **Durations:**
  - 150–200 ms: local state changes (hover, pressed, chip, field focus, snackbar in/out, table sort fade).
  - 250–300 ms: spatial changes (drawer open/close, dialog open/close, pane slide, page transitions).
- **Drawer / dialog:** 300 ms in, 250 ms out. Scrim fades at the same duration.
- **Reduced motion:** When `prefers-reduced-motion: reduce` is set, all spatial motion is disabled or reduced to a cross-fade <= 50 ms. No drawer slide, no dialog scale. This is implemented in `frontend/src/styles/admin.css` with a media query that overrides `transition-duration` and `animation-duration`.

---

## 3. Layout and navigation

### 3.1 Window size classes and breakpoints

Borrowed from M3 window size classes, mapped to CSS breakpoints for admin.

| Class | Width | Admin chrome |
|-------|-------|--------------|
| Compact | < 600px | Modal drawer (overlay), single column, gutters 16px |
| Medium | 600–839px | Modal drawer (overlay), single column, gutters 16px, dialog full-width with 16px margin |
| Expanded | 840–1199px | **Standard drawer (360px)** persistent + top bar, supporting pane 360px as side sheet when open |
| Large | 1200–1599px | Standard drawer persistent; **rail (80px) available only as explicit compact mode** via toggle |
| Extra-large | >= 1600px | Same as Large; content max-width centered |

Rules:
- The persistent standard drawer does **not** appear below 840px. Below 840px the drawer is modal only.
- The collapsed rail is **not** the default at >=1200px. It is an opt-in compact mode stored in `localStorage` key `m3-admin-sidebar-collapsed`. Unset defaults to expanded drawer (360px). This corrects the current behavior in `AdminShell.jsx:86-212` where collapsed is treated as a default.

### 3.2 Shell anatomy

```
+----------------------------------------------------------+
| Top bar (64px, surface, elevation 0; elevation 1 when    |
| scrolled) — toggle + breadcrumb/context + primary action |
+----------+---------------------------+-------------------+
| Drawer   | Content                  | Supporting pane   |
| 360px    | gutter 24px desktop      | 360px when open   |
| or       | gutter 16px compact      | (>=840px)         |
| Rail 80px| section gap 32px         |                   |
| (compact)| max-width 1200px centered |                  |
+----------+---------------------------+-------------------+
```

- **Top bar** is 64px tall (not 56px). It contains: leading nav toggle (48x48), contextual breadcrumb or page context, and at most one primary action (Filled button). Search and overflow live here. The bar is sticky.
- **Gutters:** 16px on compact/medium, 24px on expanded/large/XL. Vertical section gaps are 32px.
- **Content column:** max 1200px centered; tables may bleed to full width within the column.
- **Supporting pane:** 360px, appears inline >=840px (pushes content), modal overlay <840px. Used for inspect/edit/details, never for primary navigation.

### 3.3 Navigation destinations — the 11-item problem

`ADMIN_NAV` in `frontend/src/admin/editorial.js:214-222` currently lists 11 destinations: Dashboard + Events / Team / Partners / Gallery / Categories / Terms + Media / Invites / Users / Settings. Routing mirrors this in `frontend/src/App.jsx:84-150` behind `ProtectedRoute`.

M3 guidance is clear: a **navigation rail supports 3–7 destinations**; a **navigation drawer supports 7+**. With 11 destinations, the rail overflows or forces tiny targets. The spec resolves this:

#### Default — standard drawer (360px), grouped
Used on expanded and large by default. Three groups with dividers:

- **Overview:** Dashboard
- **Content:** Events, Team, Partners, Gallery, Categories, Terms
- **System:** Media Library, Invites, Users, Settings

Active item uses `secondary-container` background + `on-secondary-container` text/icon; inactive uses `on-surface-variant`. Focus ring is 3px `primary`.

#### Compact mode — rail (80px), curated + More
Only when the user explicitly collapses (localStorage flag). The rail shows a **curated 5** plus overflow:

- Dashboard, Events, Team, Partners, Media, **More** (opens drawer or overflow menu with Gallery, Categories, Terms, Invites, Users, Settings).

The rail never tries to fit all 11. "More" is required.

#### Modal drawer (< 600px compact, and 600–839px medium)
Drawer slides over content with scrim. Behavior: focus trap, Esc to close, scroll lock on `body`, restore focus to toggle on close. This matches the existing `AdminShell.jsx` implementation and must be preserved.

#### Current icon-key mismatches to fix
- `/admin/albums` vs `/admin/gallery` — canonical is `/admin/gallery`. Remove the `/admin/albums` key or alias it and do not show it as a separate nav item.
- `/admin/gallery/categories` vs `/admin/gallery-categories` — canonical is `/admin/gallery-categories` (kebab, matches existing route). Standardize keys.

### 3.4 Drawer and rail specifics

| Property | Standard drawer (360px) | Rail (80px compact) |
|----------|------------------------|---------------------|
| Width | 360px | 80px |
| Surface | `surface-container-low` | `surface` |
| Elevation | Level 1 | 0 |
| Item height | 56px (one line), 72px if subtitle | 56px per destination |
| Item shape | 28px pill (`extra-large`) touch target | Circular icon 48x48 + 12px label |
| Active | `secondary-container` fill | Icon filled variant + `secondary-container` pill behind icon |
| Label | `label-large` | `label-medium` |
| Icon size | 24px | 24px |

---

## 4. CRUD components

Every admin page follows the same anatomy. This is not optional.

### 4.1 Page anatomy

1. **Breadcrumb** (`nav[aria-label="Breadcrumb"]` + `ol`) — Home > Section. Omitted only on Dashboard.
2. **Title row** — `h1` at `headline-small` + one primary action at the end (Filled button). No two primaries in the row.
3. **Explanatory text** — one line of `body-medium` / `on-surface-variant` when the page needs context. Optional.
4. **Filters** — toolbar region with search field, filter chips (outlined), and sort. Never place filters after the table.
5. **Table** — see §5.
6. **Pagination** — footer row, `label-medium`, prev/next + page size.
7. **Dialogs and toasts** — layered above; see §6. Never use `alert()` or inline confirm rows.

### 4.2 Buttons — one hierarchy, no exceptions

| Variant | M3 name | Use | Token |
|---------|---------|-----|-------|
| Filled | Filled button | **One per view** — the primary action | `primary` / `on-primary` |
| Tonal | Filled tonal button | Secondary action alongside filled | `secondary-container` / `on-secondary-container` |
| Outlined | Outlined button | Neutral actions, cancel, destructive confirm border | `outline` border, `on-surface` label |
| Text | Text button | Tertiary, table row actions, dialog dismiss | `primary` label only |
| Elevated | Elevated button | Rare — only for floating over content | `surface-container-low` + level 1 |

Rules:
- The **size** for toolbar-inline buttons may be **dense 40px** tall to fit the filter bar, but the **hit area remains 48x48** (padding extends the target). This is documented as a **project extension**; M3 medium is 56px. Every dense button must still pass the 24x24 WCAG 2.2 minimum and ideally 48x48. Do not shrink to 32px.
- No page shows two Filled buttons at once. The second action is Tonal or Outlined.
- Destructive confirm dialogs use an Outlined cancel + Filled `error` confirm. Never a Filled error outside a dialog.
- Icons in buttons are 18–20px, 8px gap from label. Icon-only buttons are 48x48, `full` shape.

### 4.3 Cards

Admin cards are flat: `surface-container-high` fill, 1px `outline-variant` border, `medium` (12px) shape, elevation 0, padding 16px compact / 24px desktop. No shadow. Card title is `title-large` or `title-medium`. A card never substitutes for a table when the content is tabular.

### 4.4 Filter chips

Filter chips are `small` (8px) shape, `outline` border, `label-large`. Selected chip uses `secondary-container`. Chips sit in the filter toolbar, not inside the table header.

---

## 5. Data table

The table pattern is reused on every list page (Events, Team, Partners, Gallery, Categories, Terms, Media, Users, Invites). It reuses the same component (`frontend/src/components/admin/data-table.jsx` wrapping `frontend/src/components/ui/table.tsx` and shadcn `Table`).

### 5.1 Visual spec

| Element | Spec |
|---------|------|
| Container | `surface`, 1px `outline-variant` border, `extra-small` 4px radius, elevation 0 |
| Header row | 56px tall, `surface-container` fill, `title-small` (14/500) label, `on-surface-variant` text, no uppercase |
| Body row | 52px tall, `body-medium` (14/400), `on-surface` text; zebra is not used |
| Row divider | 1px `outline-variant` |
| Hover | `on-surface` state layer at 0.08 |
| Selected | `surface-container-highest` fill |
| Footer / pagination bar | 52px tall, `label-medium`, `on-surface-variant` |
| Sort icon | 18px, `on-surface-variant`; active sort uses `primary` |
| Checkbox | 18px, `primary` when checked |

### 5.2 Behavior and semantics — frozen APIs

- **Freeze:** The current table APIs `useLegacyTable` and `flexRender` are frozen styling-only. No prop or data-shape change in this migration. Only tokens, spacing, typography, and ARIA attributes change.
- **Semantics (required):**
  - Use native `table`, `thead`, `tbody`, `tr`, `th`, `td`. No `div` tables.
  - One `caption` per table (visually hidden is acceptable) describing the list.
  - `th` elements carry `scope="col"`.
  - `aria-sort="none|ascending|descending"` on sortable `th`.
  - The sort control is a `button` **inside** the `th` (not the `th` itself), with `aria-label="Sort by <column>"`. Target is 48x48 (hit area extends; visual may be 40px — see §4.2 dense rule).
- **Scrolling:** Exactly **one** horizontal scroll region around the table. Remove the current duplicate wrappers (`data-table.jsx:280-282` and `table.tsx:4-14` each add an overflow container). Keep a single wrapper with `overflow-x: auto` and `overscroll-behavior: contain`.

### 5.3 States

- **Loading:** Skeleton rows that preserve column widths and row height (52px). No spinner that shifts layout.
- **Empty:** Centered empty state with illustration/icon, `title-medium` heading, `body-medium` description, and a single call-to-action (Filled or Tonal). No empty table chrome alone.
- **Error:** Inline alert above the table (`error-container`), with retry action.

### 5.4 Current gaps to fix (documented, not yet migrated)

| Gap | Current | Target |
|-----|---------|--------|
| Container radius | 12px | 4px (`extra-small`) |
| Header transform | uppercase | none, `title-small` |
| Header height | 40px | 56px |
| Row height / cell padding | loose | 52px rows, consistent 16px horizontal cell padding |
| Sort target | 32px | 48x48 hit area (dense 40px visual allowed) |
| Scroll wrappers | two nested `overflow-auto` | one |
| Token usage | hard-coded hex/`rgba` | role tokens only |

---

## 6. Forms and feedback

### 6.1 Form fields

- **Style:** Outlined text field only. No filled fields in admin.
- **Height:** 56px. This is the M3 default and must match across shadcn `Input`, `Select`, `Textarea` (single line 56px, textarea auto-height with 56px min).
- **Shape:** `extra-small` (4px).
- **Typography:** Input text `body-large` (16/400), floating label `label-large` (14/500) resting at 16px top, helper/error `body-small` (12/400) below. No 13px hybrids.
- **States:** Outline `outline` at rest, `primary` on focus (3px focus ring), `error` + `error` outline on invalid.
- **Density:** No 40px form fields. The dense 40px allowance applies to toolbar buttons only. Fields stay 56px for legibility and touch.

Keep all shadcn primitives (`Input`, `Select`, `Label`, `Textarea`) but skin them via tokens, not raw hex. The `form-shell.css` wrapper may remain as the outer card around the form; inner fields use the role tokens.

#### Validation semantics (required)
- Every required field has `required` and `aria-required="true"`.
- `aria-invalid="true"` on invalid fields, with `aria-describedby` pointing to the error message `id`.
- Error messages use `error` color and `body-small`, with an icon (18px) and `role="alert"` when shown after submit.
- On submit with errors, an **error summary** appears at the top of the form, `role="alert"`, listing each invalid field as a link that moves focus to the field.
- The form footer (submit + cancel) is sticky on long forms (`position: sticky; bottom: 0;` with `surface` + top border `outline-variant`).

### 6.2 Dialogs, snackbars, and other feedback

| Pattern | When | Spec |
|---------|------|------|
| Dialog (modal) | Destructive confirm, create/edit with complex fields | `extra-large` 28px shape, `surface-container-high` fill, elevation 3, scrim `on-surface` 32%. Title `title-large`, body `body-medium`. Actions aligned end: Text cancel + Filled (or Filled error) confirm. Focus trap, Esc closes, restores focus. |
| Snackbar | Transient success/failure after a CRUD action | `inverse-surface` / `inverse-on-surface`, `extra-small` 4px, 4–10 s, one action max (e.g., Undo). Never for decisions. |
| Banner / inline alert | Persistent page-level warning or non-blocking error | `error-container` or `tertiary-container`, `small` 8px, with icon. |
| Skeleton | Loading | Preserves dimensions of the final content; shimmer uses `outline-variant` → `surface-container` gradient. No layout shift when data arrives. |

Rules:
- **Dialog vs snackbar:** If the user must decide, use a dialog. If you are just confirming what happened, use a snackbar. Never use a snackbar for "Are you sure?".
- **Status colors never convey meaning alone.** Every badge pairs color with text and icon.

#### Status mapping

| Status | Badge fill | Badge text | Icon |
|--------|------------|------------|------|
| Draft | `surface-container` (neutral) | `on-surface-variant` | `draft` / `schedule` |
| Published | `secondary-container` | `on-secondary-container` | `check_circle` |
| Warning / Needs review | `tertiary-container` | `on-tertiary-container` | `warning` |
| Error / Rejected | `error-container` | `on-error-container` | `error` |

---

## 7. Accessibility, dark mode, and reduced motion

### 7.1 Accessibility — non-negotiable

| Requirement | Target |
|-------------|--------|
| Hit area | **48x48 preferred**, **24x24 minimum** (WCAG 2.2 SC 2.5.8). Dense toolbar buttons keep 48x48 hit area even at 40px visual height. |
| Contrast — text | 4.5:1 small text, 3:1 large text/UI. Verify with role token pairs; e.g., `on-primary` on `primary` must pass. |
| Contrast — non-text | 3:1 for icons, borders, focus indicators. |
| Focus | 3px `primary` outline, visible on every interactive element. No `outline: none` without replacement. |
| Landmarks | `header` (banner), `nav` (drawer/rail), `main`, `footer` (optional). Exactly **one `h1` per page** (`headline-small`). |
| Breadcrumbs | `nav[aria-label="Breadcrumb"]` with `ol` + `li`. Current page has `aria-current="page"`. |
| Zoom | Layout usable at **320px viewport width** and at **200% browser zoom** without horizontal scroll on the page (table may scroll internally). |
| Dialog / drawer | Focus contained, Esc closes, focus restored, background `inert` (or `aria-hidden` + pointer-events none). Scroll lock on `body` while modal is open. |
| Motion | Respects `prefers-reduced-motion` (see §2.5). |

### 7.2 Dark mode

- Dark scheme is defined under `.dark` in `frontend/src/index.css:814-847`. The implementation to wire it up is still missing.
- **Mechanism:** A `ThemeProvider` (or equivalent) toggles the `.dark` class on `html`. Persist choice in `localStorage` (e.g., `m3-admin-theme = light|dark|system`). On `system`, follow `prefers-color-scheme`.
- **Toggle UI:** A theme switch in Settings and optionally in the top bar overflow. Do not block the rest of the migration on this toggle; dark tokens must already be correct before the toggle ships.
- **Common bug:** Hard-coded `rgba()` or `#0A4EB8` or `bg-white` in `admin.css` breaks dark. Every color must go through a role token. Audit with a dark-mode visual pass (see §9 checklist).
- **Images and media thumbnails:** Apply no inversion or extra dimming by default; let the surface do the work. If thumbnails need a border in dark, use `outline-variant`.

### 7.3 Reduced motion

- All spatial transitions (drawer slide, dialog scale, pane slide) disable or collapse to fade when `prefers-reduced-motion: reduce` matches.
- Implementation: a global media query at the end of `frontend/src/styles/admin.css` that sets `transition-duration: 0.01ms` and `animation-duration: 0.01ms` for `.admin-shell` descendants, with `scroll-behavior: auto`.
- Skeleton shimmer also disables animation under reduced motion (static placeholder).

---

## 8. Repo fit — where tokens live and how they reach components

### 8.1 File map

| File | Role |
|------|------|
| `frontend/src/index.css:648-702` | Tailwind `@theme inline` — maps CSS vars to Tailwind tokens |
| `frontend/src/index.css:748-812` | Light scheme `--m3-*` + `--md-sys-*` definitions on `:root` |
| `frontend/src/index.css:814-847` | Dark scheme overrides under `.dark` |
| `frontend/src/styles/admin.css:1-1301` | Admin scope — shell layout, drawer/rail, top bar, table skin, component overrides. Must be layered after shadcn. |
| `frontend/src/styles/form-shell.css` | Outer form card chrome (surface, radius, padding). Inner fields use role tokens. |
| `frontend/src/components/admin/AdminShell.jsx:86-212` | Shell behavior: 360px drawer, 80px rail, localStorage key `m3-admin-sidebar-collapsed`, modal <1200px, focus-trap/Esc/scroll-lock |
| `frontend/src/admin/editorial.js:214-222` | `ADMIN_NAV` canonical list of 11 destinations — source of truth for nav labels/routes |
| `frontend/src/App.jsx:84-150` | Route table under `ProtectedRoute` + `AdminShell` |
| `frontend/src/components/ui/*` | shadcn primitives (`button.tsx`, `table.tsx`, `input.tsx`, etc.) remapped to M3 |
| `frontend/src/components/admin/data-table.jsx` | Table wrapper — frozen `useLegacyTable`/`flexRender` API |

### 8.2 Canonical tokens — `--md-sys-*` is canonical, `--m3-*` is an alias

Define every token as `--md-sys-*` first. Keep `--m3-*` as a **deprecated alias** for one release so existing CSS does not break during migration.

```css
/* frontend/src/index.css — :root (light) */
:root {
  /* canonical */
  --md-sys-color-primary: #0a4eb8;
  --md-sys-color-on-primary: #ffffff;
  --md-sys-color-primary-container: #d6e2ff;
  /* ... all roles ... */
  --md-sys-color-surface: #fdfbff;
  --md-sys-color-surface-container-low: #f3f3f7;
  --md-sys-color-surface-container: #efedf0;
  --md-sys-color-surface-container-high: #e9e7eb;
  --md-sys-color-surface-container-highest: #e3e1e5;
  --md-sys-color-outline: #797680;
  --md-sys-color-outline-variant: #c9c5d0;
  --md-sys-color-error: #ba1a1a;
  --md-sys-color-error-container: #ffdad6;
  /* ... */

  /* aliases — remove after migration */
  --m3-primary: var(--md-sys-color-primary);
  --m3-on-primary: var(--md-sys-color-on-primary);
  /* ... mirror every --md-sys-* ... */
}
```

Do the same under `.dark`. New code must reference `--md-sys-*` only. Linter or grep can enforce `grep -R "--m3-" frontend/src --include="*.css" --include="*.tsx"` and flag new uses.

### 8.3 Tailwind `@theme inline` mapping

`frontend/src/index.css:648-702` maps CSS vars into Tailwind's theme so utilities like `bg-primary` and `text-on-surface` can be used.

```css
@theme inline {
  --color-primary: var(--md-sys-color-primary);
  --color-on-primary: var(--md-sys-color-on-primary);
  --color-surface: var(--md-sys-color-surface);
  --color-surface-container: var(--md-sys-color-surface-container);
  --color-surface-container-highest: var(--md-sys-color-surface-container-highest);
  --color-outline-variant: var(--md-sys-color-outline-variant);
  --color-error: var(--md-sys-color-error);
  --color-error-container: var(--md-sys-color-error-container);
  /* ... one entry per role ... */

  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 28px;

  --font-display: "Google Sans Flex", "Google Sans", Roboto, sans-serif;
  --font-body: "Roboto Flex", Roboto, sans-serif;
}
```

Rules:
- Every `--md-sys-color-*` gets a `--color-*` entry.
- Every `--md-sys-shape-corner-*` gets a `--radius-*` entry.
- No hard-coded Tailwind color like `bg-[#0A4EB8]` in admin code after migration.

### 8.4 shadcn scoping to `.admin-shell`

shadcn primitives are shared with the public site. Admin overrides must not leak.

- Scope all admin token overrides under `.admin-shell` (or `[data-admin]` attribute if preferred), e.g.:

```css
.admin-shell {
  --primary: var(--md-sys-color-primary);
  --primary-foreground: var(--md-sys-color-on-primary);
  --card: var(--md-sys-color-surface-container-high);
  --border: var(--md-sys-color-outline-variant);
  --radius: 16px; /* maps to large */
}
```

- `components/ui/button.tsx` is already remapped to M3 pill (`full` shape). Keep that mapping. Do not reintroduce per-page button CSS.
- `components/ui/table.tsx` must not add its own `overflow-auto` wrapper. The single wrapper lives in `data-table.jsx`.

---

## 9. Migration sequence, doc updates, and validation

### 9.1 Migration sequence — do in order, ship per phase

Each phase is one PR, one review, one visual pass. Do not combine phases.

**Phase 0 — Prep (no visual change)**
- Add `--md-sys-*` canonical tokens in `index.css:748-847` alongside existing `--m3-*`. Add `--m3-*` aliases that point to the canonical values. Wire `@theme inline` mappings. No component change yet. Verify build passes.

**Phase 1 — Foundations (typography + shape + elevation)**
- Consolidate font loading to Google Sans Flex + Roboto Flex; update `@theme inline` font entries. Remove Archivo imports from admin.
- Apply shape scale: table container 12px → 4px, dialogs 28px, cards 12px. Remove shadows from cards/tables. Elevation is now 0 for those surfaces.
- Fix hard-coded `rgba`/`#0A4EB8`/`bg-white` in `admin.css` to role tokens.

**Phase 2 — Layout and navigation**
- Fix `AdminShell.jsx` default: standard drawer (360px) is the default at >=840px; rail (80px) only when `localStorage:m3-admin-sidebar-collapsed === "true"`.
- Group drawer items (Overview / Content / System) with dividers.
- Implement the curated rail + More overflow for compact mode.
- Standardize nav keys: remove `/admin/albums` duplicate, canonical `/admin/gallery`; unify `/admin/gallery-categories`.
- Top bar to 64px; gutters 16px compact / 24px desktop; section gaps 32px; supporting pane 360px >=840px.

**Phase 3 — Data table**
- Collapse duplicate scroll wrappers to one (`data-table.jsx` owns it).
- Apply 56px header / 52px rows / `title-small` / `body-medium` / 4px container / no-uppercase.
- Sort button 48x48 hit area (dense 40px visual allowed).
- Wire native `table` semantics: `caption`, `scope="col"`, `aria-sort`, sort `button` in `th`.
- Freeze `useLegacyTable`/`flexRender` styling-only change.

**Phase 4 — CRUD pages and buttons**
- Enforce page anatomy on every `/admin/*` page (breadcrumb → title+primary → explanatory → filters → table → pagination → dialogs/toasts).
- Button hierarchy: one Filled primary per view, dense 40px toolbar buttons with 48x48 hit area documented as extension.
- Status badges to semantic containers with icon + text.

**Phase 5 — Forms and feedback**
- Outlined 56px fields, `body-large` input, `label-large` label, `body-small` helper/error, required semantics, error summary, sticky footer.
- Dialog/snackbar audit: decisions = dialog (elevation 3, 28px, focus trap), transient = snackbar (inverse-surface).

**Phase 6 — A11y, dark, reduced motion**
- Add `ThemeProvider` / `.dark` toggle (persist `m3-admin-theme`), wire `prefers-color-scheme` for `system`.
- Global `prefers-reduced-motion` overrides in `admin.css`.
- Contrast and hit-area pass; landmarks/one-h1/breadcrumbs.

### 9.2 Doc updates after each phase

| Document | Action |
|----------|--------|
| `docs/admin-data-table.md` | Update to reflect §5 (4px, 56/52px, single scroll, frozen APIs) or mark as superseded by this file and delete. Current file is stale and must not be treated as authoritative. |
| `docs/admin-forms.md` | Update to reflect §6.1 (56px outlined, body-large/label-large/body-small, error summary, sticky footer) or supersede/delete. |
| `docs/ARCHITECTURE-OVERVIEW.md` | Add a short "Admin design system" entry pointing here. |
| `docs/GETTING-STARTED.md` | If it mentions admin fonts or colors, point to this spec. |

After Phase 6, add a one-line deprecation notice at the top of the two stale docs if not yet deleted, linking to this file as canonical.

### 9.3 Validation checklist — run per breakpoint

Run the checklist at **every** breakpoint before merging the phase PR. Az the package table says, validation owner is **orchestrator** (not this spec). This checklist is what to validate.

| Breakpoint | Width to test | What to check |
|------------|---------------|----------------|
| Compact | 360px | Modal drawer: scrim, Esc, focus trap, scroll lock. Gutters 16px. No horizontal page scroll. Table scrolls internally in one region. Top bar 64px + overflow menu. |
| Medium | 720px | Same as compact, plus dialog full-width margin 16px. |
| Expanded | 1024px | **Standard drawer 360px persistent**, grouped nav, gutters 24px, section gaps 32px. Supporting pane pushes content if open. |
| Large | 1280px | Expanded drawer by default; toggle to compact rail 80px works and persists in localStorage. Curated rail + More shows overflow. |
| Extra-large | 1600px | Content centered at max 1200px. Drawer + content + pane proportions hold. No stretched tables. |

#### Cross-cutting checks (every breakpoint, light + dark)
- [ ] No hard-coded hex/`rgba` outside `index.css` token definitions (`grep -R "#0A" frontend/src` clean except token defs).
- [ ] Typography: page title is `headline-small` (24/32/400 Google Sans Flex), table header `title-small` (14/20/500), body `body-medium`, labels `label-large`/`label-medium`. No uppercase headers.
- [ ] Shape: table 4px, card 12px, button pill/full or 16px large, dialog 28px.
- [ ] Elevation: tables/cards/bars at 0, drawer at 1, dialogs at 3. No other shadows.
- [ ] Buttons: one Filled per view; dense 40px toolbar buttons have 48x48 hit area; destructive confirm is inside a dialog.
- [ ] Table: 56px header, 52px rows, 16px horizontal cell padding, selected = `surface-container-highest`, hover = 0.08 state layer, `caption` + `scope` + `aria-sort` + sort `button` in `th`, single scroll wrapper, frozen API.
- [ ] Forms: 56px outlined fields, helper 12px, error summary links to fields, sticky footer.
- [ ] Status badges: Draft neutral / Published `secondary-container` / Warning `tertiary-container` / Error `error-container`, always with text + icon.
- [ ] Focus: 3px `primary` outline visible with keyboard; persists in high-contrast.
- [ ] Contrast: 4.5:1 small, 3:1 large/non-text (check with axe or Lighthouse).
- [ ] Hit area: 48x48 preferred, 24x24 minimum (verify sort, icon buttons, chips).
- [ ] Landmarks: `header`, `nav`, `main`; one `h1`; breadcrumb `nav > ol`.
- [ ] 320px viewport and 200% zoom usable.
- [ ] Drawer/dialog: focus contained, Esc, restore, scrim 32%, `inert` background.
- [ ] `prefers-reduced-motion: reduce` disables drawer slide/dialog scale/skeleton shimmer.
- [ ] Dark mode: toggle `.dark` class flips every surface correctly; no white flash or unreadable text.
- [ ] No uppercase table headers, no duplicate scrollbars, no dual Filled buttons.

---

## Appendix A — Token quick-reference (canonical names)

```
--md-sys-color-primary
--md-sys-color-on-primary
--md-sys-color-primary-container / --md-sys-color-on-primary-container
--md-sys-color-secondary / --md-sys-color-on-secondary
--md-sys-color-secondary-container / --md-sys-color-on-secondary-container
--md-sys-color-tertiary / --md-sys-color-on-tertiary
--md-sys-color-tertiary-container / --md-sys-color-on-tertiary-container
--md-sys-color-error / --md-sys-color-on-error
--md-sys-color-error-container / --md-sys-color-on-error-container
--md-sys-color-surface / --md-sys-color-on-surface
--md-sys-color-surface-variant / --md-sys-color-on-surface-variant
--md-sys-color-surface-container-low
--md-sys-color-surface-container
--md-sys-color-surface-container-high
--md-sys-color-surface-container-highest
--md-sys-color-outline / --md-sys-color-outline-variant
--md-sys-color-scrim
--md-sys-color-inverse-surface / --md-sys-color-inverse-on-surface / --md-sys-color-inverse-primary

--md-sys-typescale-headline-small  (24/32/400)
--md-sys-typescale-title-large     (22/28/400)
--md-sys-typescale-title-medium    (16/24/500)
--md-sys-typescale-title-small     (14/20/500)
--md-sys-typescale-body-large      (16/24/400)
--md-sys-typescale-body-medium     (14/20/400)
--md-sys-typescale-body-small      (12/16/400)
--md-sys-typescale-label-large     (14/20/500)
--md-sys-typescale-label-medium    (12/16/500)
--md-sys-typescale-label-small     (11/16/500)

--md-sys-shape-corner-none         (0)
--md-sys-shape-corner-extra-small  (4px)
--md-sys-shape-corner-small        (8px)
--md-sys-shape-corner-medium       (12px)
--md-sys-shape-corner-large        (16px)
--md-sys-shape-corner-extra-large  (28px)
--md-sys-shape-corner-full         (9999px)

--md-sys-elevation-level0  (none)
--md-sys-elevation-level1  (1dp)
--md-sys-elevation-level3  (3dp)

--md-sys-motion-easing-standard              (cubic-bezier(0.2,0,0,1))
--md-sys-motion-duration-short               (150ms)
--md-sys-motion-duration-medium              (250ms)
--md-sys-motion-duration-long                (300ms)
```

Aliases mirror each entry as `--m3-*` until Phase 6 completes.

---

## Appendix B — What this spec deliberately does not cover

- Public site styling, marketing pages, or the event gallery front-end.
- Backend or API changes. `VITE_API_URL` and Better Auth session handling are unchanged.
- New component libraries or icon sets. Use the existing Lucide set and current shadcn primitives.
- Expressive tokens, morphing shapes, or spring motion — inspiration only, not normative.

---

*End of spec. Keep this file as the single source of truth for admin visual decisions. When code and this file disagree, update the code.*
