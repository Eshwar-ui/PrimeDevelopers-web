# Admin dashboard — design audit

16 Oct 2026 · scope: `apps/web/src/admin/**` · walked at 1440 and 375 against the
deployed API, read against `DESIGN.md` and `CLAUDE.md`.

The admin is used by non-technical editors at the client. The bar is: an editor
should never have to wonder where something is edited, whether it saved, or
whether a click did anything.

## What is already right

- Every field the public site renders has a control (checked mechanically:
  `DEFAULTS` in `ContentContext.jsx` against `sectionEditors.jsx`). The three
  keys without one — `about_home.*`, `gallery.eyebrow/features`,
  `properties_page.heroSlides` — are not rendered anywhere.
- Property editor: real ARIA tabs, dirty tracking, sticky Save, preserved
  section open state. Image uploader previews before upload. Drawer nav has a
  focus trap and returns focus.

## Phase 1 — Critical

| # | Finding | Fix |
|---|---|---|
| 1.1 | **Dashboard is a dead end.** Three numbers, one hardcoded wrong ("11 site content sections" — there are 29). Nothing about leads, the only time-sensitive thing in the admin. | Rebuild: new-lead count first, then properties / posts with draft counts, content sections from `SECTIONS.length`; recent leads, drafts, and shortcuts to the most-edited sections. |
| 1.2 | **Unsaved work is lost silently.** Property edit knows it's dirty but lets you leave; Content and News editors don't track dirty at all. | Shared `useDirty` + `LeaveGuard`: `beforeunload` for tab close/reload, a page-drawn dialog for in-app links (Stay / Leave without saving / Save and leave). |
| 1.3 | **Save scrolls out of reach** on Content and News editors (Interiors catalog is thousands of px long). | One sticky `EditorBar` shared by all three editors: back link, title, status, View live, Save, ⌘/Ctrl+S. |
| 1.4 | **Native `confirm()`/`alert()`** in News list, Leads, ModelManager, SiteModelManager — the exact bug documented in `PropertiesListPage` (browsers let users suppress them; Delete then silently does nothing). | Shared inline `ConfirmButton`, used everywhere a destructive action lives. |
| 1.5 | **Primary buttons fail contrast in light theme.** `bg-accent text-void`: `accent` is a per-theme token, CG Blue `#0073a4` in light → 3.6:1 against void. The admin ground is always dark. | Primary = `bg-accent-soft text-void` (8.2:1), hover `accent-hi`. Pigments, since the admin surface doesn't follow the theme. |
| 1.6 | **Leads can only be toggled new/read.** The API accepts `new / read / contacted / qualified / closed`. No filter, no search, no mailto/tel. | Status select per lead, status filter with counts, search, mailto/tel links. *(Functional — requested.)* |
| 1.7 | **Listing-card figures aren't editable.** `/properties` cards read `detail.specs` ("2.5 Acres", "Ready") and fall back to the integer columns; no admin control writes it. | "Listing card figures" — three short text fields in Basics. *(Functional — requested.)* |
| 1.8 | **29 content sections in one flat grid**, no grouping, no search. | Group by where they appear (Homepage · Site-wide · Pages · Enterprise · Property pages) and add a filter. |
| 1.9 | **Phone layout breaks.** Every form uses `grid-cols-2/3` without a breakpoint; list-row actions and the editor header overflow at 375px. | `grid-cols-1 sm:grid-cols-2/3`; rows stack; header wraps. |

## Phase 2 — Refinement

| # | Finding | Fix |
|---|---|---|
| 2.1 | Six hand-rolled button styles; text links as actions (`Edit`, `Delete`, `Remove`) with no hit area. | `Button` primitive: primary / secondary / ghost / danger, 44px min target, focus ring, disabled state. |
| 2.2 | 100 call sites of 9–11px text — most helper copy an editor needs to read. | Helper text to 12px (`text-xs`); badges to 11px minimum. |
| 2.3 | Inputs remove the outline and only change border colour; 14px text zooms iOS. | Visible focus ring; `min-h-11`; 16px on phones, 14px from `sm`. |
| 2.4 | No icons in nav; actions use text glyphs (`↗ ← +`). Phosphor is already a dependency. | Phosphor, one weight, in nav and actions. |
| 2.5 | Draft is shown, Live isn't — status by absence. | `StatusPill` Live / Draft, always with text. |
| 2.6 | `RepeatableList` claims reorder in its header comment but has none — slides, logos, testimonials can't be re-ordered. | Move up / down per item, numbered items. |
| 2.7 | Errors are raw `text-red-400` paragraphs with no role. | One `Alert` with `role="alert"`. |
| 2.8 | Properties and News lists have no search and no "view live". | Filter box; View live per published row. |

## Phase 3 — Polish

| # | Finding | Fix |
|---|---|---|
| 3.1 | Leads shows nothing while loading. | Skeleton rows. |
| 3.2 | Empty lists render nothing. | Empty states with the first action. |
| 3.3 | "Saved" stays forever and isn't announced. | Status in an `aria-live` region, "Saved" fades after a few seconds. |
| 3.4 | Every admin tab is titled with the homepage title. | `document.title` per admin page. |
| 3.5 | Login: no `autocomplete`, no password reveal, inputs styled unlike the rest of the admin. | Autocomplete attributes, show/hide toggle, shared field styles. |
| 3.6 | Sidebar doesn't show who is signed in or that there are new leads. | User email at the foot; new-lead badge on Leads. |

## Status

All three phases implemented and verified in the Browser pane at 1440 and
375, signed in against an in-page network stub — every write was answered
locally, nothing reached the production API.

Verified: dashboard counts and recent leads; lead status change (PATCH),
status filter + URL sync, search, inline delete with Escape-to-cancel and focus
return; section filter; dirty tracking, reorder, ⌘S save (only changed keys
sent), the leave dialog's Keep editing / Discard / Save and leave; listing-card
figures saved with empty slots dropped; mobile drawer, editor bar (157px, was
~210px) and list rows with no horizontal overflow.

Also fixed on the way:

- **Sticky bars never stuck.** `<main>` carried `overflow-y-auto` with no
  bounded height, so the window scrolled and the property editor's "sticky"
  bar scrolled away with it. The admin is now a fixed-viewport shell.
- **News editor lost typing on save** — same re-seed-on-refetch bug the
  property editor had already been fixed for.

## Follow-up: `/properties/:slug/info`

Audited at 1239, 768 and 375.

- **Sizing.** The bands were a three-column grid, but the sheets come in every
  shape (1:1 site plan, 1.5:1 trade map, 0.77:1 floor plans), so rows ended
  ragged and a sheet that didn't fit left a hole. Bands are now justified rows:
  every image in a row shares a height, nothing is cropped, rows are flush at
  both edges, and row breaks are chosen together so no sheet is stranded.
  The `h1` ran to 5.5rem — half as large again as the property page — and is
  now on the shared hero scale; section headings and band spacing likewise.
- **Buildings.** The separate photography and floor-plan bands are joined by a
  Buildings section: one building at a time, its photograph beside its
  floor-plan sheet at equal height, with live availability from Floor plans.
- **Editable.** The page lives on the property at `detail.info`, edited from a
  new Info page tab. The Centro set in code is the fallback until first save.
- **Dark theme.** `base` and `void` are the same colour there, so the
  alternating bands no longer separated; each band now carries a hairline.

## Not in this pass

- Browser Back with unsaved changes is not intercepted — that needs a data
  router (`createBrowserRouter`) for `useBlocker`. Reload and tab close are.
- Admin list thumbnails load the full-size originals (2560px for an 80px
  frame). `lib/images.js` already has the Supabase render transform.
- Leads are fetched whole; fine at today's volume, worth paginating past a few
  hundred.
