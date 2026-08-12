# Prime Developer — design system

How the front end is built, and why. The brand's own rules (palette, fonts, logo
safe zones) live in [CLAUDE.md](CLAUDE.md) and the source PDF; this describes the
system built on top of them.

Everything here is defined in [`apps/web/src/index.css`](apps/web/src/index.css).
There is one stylesheet. Components carry Tailwind utilities, not their own CSS.

---

## 1. Tokens

Tailwind v4's `@theme` block is the single source of truth. Declaring a variable
there both defines it and generates the matching utility, so `--color-accent`
gives you `text-accent`, `bg-accent`, `border-accent` at once.

**Two tiers, and the distinction is load-bearing.**

*Pigments* are named after what they are and hold their value in both themes:
`void`, `ink`, `carbon`, `bone`, `charcoal`, `accent`, `ember`. Use one when the
thing it paints is itself fixed — type on a hardcoded white disc, a logo, a
button that is always blue.

*Role tokens* are named after the job and change per theme: `surface`,
`surface-alt`, `content`, `invert`, `invert-fg`, `line`. Use one when the thing
should follow the theme — a section ground, body copy, a hairline.

Getting this backwards is the most common bug in this codebase and it is always
invisible in the theme you built it in:

- `text-content` on a hardcoded `bg-white` disc → near-white on white in dark
  mode. (Was live in `PrimePill`.)
- A hardcoded `#fff` in a gradient meant to match `surface` → two lit squares
  hanging off a dark panel in dark mode. (Was live in the homepage hero notch.)

**Always check both themes before calling a colour done.**

### Theming

`.dark` on `<html>`, set by `ThemeContext` and mirrored by an inline boot script
in `index.html` so the first paint is already correct. The dark block is written
`:root.dark` rather than `.dark` so it outweighs the `:root` block Tailwind emits
for `@theme` regardless of layer order.

Dark mode overrides role tokens and hairlines only. One deliberate exception:
`--color-accent` lifts from CG Blue `#0073a4` to `#3e9bc7` in dark, because the
brand blue measures 2.9:1 on the dark ground — under AA, and it carries real
text.

### `@theme` is tree-shaken

A variable declared in `@theme` is only emitted if something uses it, and a
utility only exists if the class appears in **scanned source**. A class invented
at runtime will never resolve. To verify a token, use it in a component and
measure the real element.

---

## 2. Type

Rubik for display, Arimo for body — `--font-display` / `--font-body`.

Headings are set with an explicit `clamp()` rather than a step on a scale,
because each one is solving a different constraint:

| Where | Size |
|---|---|
| Home hero `h1` | `clamp(2.25rem, min(4.9vw, 9.5dvh), 4.35rem)` |
| `/properties` `h2`, property detail `h1` | `clamp(1.85rem, 4.2vw, 3.4rem)` |
| Section headings | `clamp(1.9rem, 3.4vw, 3rem)` |

The `dvh` term appears only where a heading shares a **fixed one-screen fold**
with something below it — the home hero with its thumbnail rail, `/properties`
with its photographic band. There, a short wide window has to shrink the type
rather than push the other element off screen. Adding `dvh` anywhere else only
shrinks type for no reason.

Shared treatment across all heroes: `font-display font-bold uppercase
leading-[1.03] tracking-tight`.

Body lede is `15px / leading-relaxed / text-content/60`. The measure varies with
the layout — `max-w-120` when set left in a column beside a visual, `40rem` when
centred under a full-width heading, where the narrow measure breaks into stub
lines.

Two utility classes: `.eyebrow` (bold, uppercase, `0.28em` tracking) and
`.numeral` (tabular figures, tight leading, for large statistics).

---

## 3. Spacing

`--spacing-gutter` (`1.5rem`) and `--spacing-gutter-lg` (`6.25rem`) → `px-gutter`
and `md:px-gutter-lg`.

Two values, not a scale. The narrow one is a phone's thumb margin; the wide one
is what the designs draw. Anything in between is a section disagreeing with the
page.

> **Migration in progress.** `/properties/:slug` uses the gutter tokens above the
> floor-plan section. Everything else is still on literal `px-6 md:px-12` or
> `md:px-[75px]`. Until that is finished, some pages step in the left margin
> partway down.

---

## 4. Shape

`--radius-frame` 32px · `--radius-panel` 20px · `--radius-notch` 44px →
`rounded-frame`, `rounded-panel`, `rounded-notch`.

Named by the job the corner is doing, not by size, so a photographic frame and a
card cannot quietly drift apart.

`notch` is the odd one: it is the radius of a corner turned **inside out**, where
a bay of page ground meets the edge of a frame. It reads larger than the frame's
own radius because a concave curve of equal radius looks tighter than a convex
one.

### The notch / bay idiom

[`lib/notch.js`](apps/web/src/lib/notch.js) exports `invertedCorner(origin)`.

A bay is page ground carried *into* a frame — the homepage hero cuts one from the
left of its visual to seat the header rail; the property hero cuts one from the
top of its photograph to seat the social buttons. The bay itself is a plain
`bg-surface` rectangle with a convex radius; each end is closed by an
`invertedCorner` so the join reads as a curve rather than a step.

Rules:

- The frame declares `--notch-r` once; the bay and both corners read it.
- `origin` is the corner the curve sweeps **away** from. A bay hanging from a top
  edge uses `0% 100%` on its left and `100% 100%` on its right.
- Fill is `--color-surface`, never a literal.
- **Anything that must cross the frame's edge cannot live inside it** — the frame
  clips its own corners. On the property hero the bay is decoration inside the
  clip and the buttons are a sibling outside it, centred on the edge with
  `-translate-y-1/2`. That split is the whole reason the bay is cut.

---

## 5. Motion

`--ease-brand` `cubic-bezier(0.16, 1, 0.3, 1)` — the decelerating curve that
carries nearly every entrance. `--ease-exit` `cubic-bezier(0.4, 0, 1, 1)`
accelerates, because something leaving should look taken away. `--ease-swap`
`cubic-bezier(0.76, 0, 0.24, 1)` is symmetric, for a thing replacing another in
place. Utilities: `ease-brand`, `ease-exit`, `ease-swap`.

Naming them is what stops the next component inventing a fourth cubic-bezier
that is almost but not quite the same.

### The reveal vocabulary

**Masked word rise** — [`MaskedHeading`](apps/web/src/components/MaskedHeading.jsx).
Splits a heading into per-word spans, each clipped by its own `overflow-hidden`
box and animated with the `.word-rise` keyframe on a 52ms stagger. Per-word, not
per-line, because line breaks are the browser's and re-wrap at every breakpoint.

It is **CSS, not JS**, on purpose: a masked word's resting position is *outside*
its box, so a reveal that fails to run leaves the headline permanently invisible.
A keyframe cannot fail to run.

It carries the same `*emphasis*` convention as `renderEmphasis` and takes an
`accentClass` — the home hero passes nothing, where the flourish would fight a
headline already in full display caps.

**Block stagger** — the `rise` / `stagger` variant pair (`y: 26 → 0`, 0.85s,
`staggerChildren: 0.09`, `delayChildren: 0.15`). A heading inside a stagger
container must **not** be a motion child: a block-level lift would move each mask
along with the word inside it, leaving nothing to rise out of.

**Page transition** — `AnimatePresence mode="wait"` in `App.jsx`, keyed on
pathname. 0.3s out on `ease-exit`, 0.5s in on `ease-brand`. `mode="wait"` is
load-bearing, not decorative: it buys a frame with nothing mounted, which is the
only moment the jump back to the top of the document can happen unseen.

### Reduced motion

`@media (prefers-reduced-motion: reduce)` disables `.word-rise`, `.panel-wipe`,
the ticker, the Ken Burns push and the theme wipe, and collapses all transition
durations. Components that gate their own animation read the media query
directly. Honour it in anything new.

---

## 6. The band system

The fixed header has no ground of its own, so it has to know what it is over.
Any light-grounded section carries `data-band="light"`. `Navbar` observes those
with an IntersectionObserver through a thin strip at header height and flips its
chrome to charcoal.

Two things this gets wrong if you are careless:

- `isDark` **vetoes** it. `data-band="light"` marks sections that are light *in
  the light theme*; under dark mode those same sections are dark grounds, and
  without the veto the header would paint charcoal type onto them.
- The observer rebuilds when `<main>` swaps its child, **not** on pathname
  change. The page transition holds the incoming route back until the outgoing
  one has left, so a pathname-triggered build runs against an empty `<main>`,
  finds no bands, and leaves the header bone-on-bone.

---

## 7. Component vocabulary

| Component | Job |
|---|---|
| [`PrimePill`](apps/web/src/components/PrimePill.jsx) | The primary CTA — CG Blue lozenge with a white arrow disc. `variant="outline"` drops the fill and the disc for the second of a pair. Shared so hero and interior pages cannot drift. |
| [`MaskedHeading`](apps/web/src/components/MaskedHeading.jsx) | Per-word masked rise for any CMS heading. |
| [`PropertyStrip`](apps/web/src/components/PropertyStrip.jsx) | Full-bleed looping photo carousel. Panels are fixed width; the *track* translates. |
| [`invertedCorner`](apps/web/src/lib/notch.js) | Concave corner joining a bay to a frame. |
| [`SectionTag`](apps/web/src/pages/PropertyDetailPage.jsx) | Eyebrow label with the accent dash. |

### Looping carousels

Both the home hero rail and `PropertyStrip` use the same machinery: a window of
whole sets rendered around the live position with headroom either side, grown on
demand so clicking ahead cannot outrun the rendered rail, folded back with the
transition suppressed once the track walks outside one set. It lands on a
congruent position — a pixel-identical frame — so the seam is invisible.

Positive modulo (`((n % m) + m) % m`) throughout: position runs negative, and
JS's `%` keeps the sign of the dividend.

---

## 8. Content

Every section reads from `useSection(key)`, which shallow-merges the API response
over `DEFAULTS` in
[`ContentContext.jsx`](apps/web/src/context/ContentContext.jsx).

Because the merge is shallow **per section**, a key the live row does not carry
falls back to the default, but a key it carries as `''` wins. So a default is a
real fallback for a not-yet-seeded row, and the way to ship copy or an asset for
a section that predates a key is to put it in `DEFAULTS` — that is why
`about_home`'s film, `services_home`'s copy and `cta_home`'s photograph live
there.

New editable fields need three edits: `DEFAULTS`, `scripts/seed.js`, and the
section's entry in `admin/content/sectionEditors.jsx`. Skip the third and the
field exists but nobody can change it.

---

## 9. Gotchas

Each of these has cost real debugging time.

**GSAP leaves an inline transform.** Any element revealed by GSAP on `y` carries
`transform` inline afterwards, and an inline style always beats a utility class.
`hover:-translate-y-*` on such an element silently stops working once the reveal
runs. Carry hover on shadow, colour or a child instead.

**A mask is resolved in the element's own box, then scaled with it.** Putting a
mask on a `scale-125` element lands every stop 25% adrift. Mask an unscaled
wrapper and scale the child inside it.

**`backdrop-filter` clips its blurred backdrop to its own box.** Its leading edge
is a hard step that no mask on that same element can soften. For a seam, use a
blurred *duplicate* with `filter: blur()`.

**Ramping a gradient to `transparent` in sRGB passes through grey.** Fade the
element with an alpha mask and let the ground show through instead.

**Composited alphas multiply.** Two stacked masked layers read as
`1-(1-a₁)(1-a₂)`. Tune the pair against that, not each in isolation.

**`{/* … */}` is invalid in a JS expression.** Inside `{cond && ( … )}` the braces
parse as an object literal. Use a bare `/* … */`.

**`requestAnimationFrame` does not fire in a tab that is not rendering.** Gating
anything on it — a reveal, a state flip — leaves that state stuck until the tab
is focused. Prefer a timer. This also means framer-motion, Lenis, CSS transitions
and IntersectionObserver are all inert in a non-rendering tab, so **animation
cannot be verified there** — only structure and computed styles can.

**Absolutely positioned replaced elements ignore over-constrained insets.** For
an `<img>` with `width: auto`, `-inset-16` resolves to the intrinsic size, not
the box. Use a transform, or state the size.
