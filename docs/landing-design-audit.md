# Landing page — design audit

Route `/`. Ten sections plus footer. Visual scope only: layout, typography, colour,
motion, accessibility. No application logic, data models or feature changes proposed.

**Audited against dark, because dark is what ships.** `ThemeToggle.jsx` is imported
nowhere, `preferredTheme()` returns `'dark'` unless `localStorage` says otherwise, the
boot script in `index.html` defaults `dark = true`, and the OS listener was deliberately
removed. Light mode is reachable only by hand-setting `localStorage.prime-theme = 'light'`
in devtools. Every ratio below is measured against the grounds a visitor actually gets.

Contrast computed in sRGB from the resolved token values in
[`apps/web/src/index.css`](../apps/web/src/index.css). Large-text threshold applied at
3:1 where the type qualifies.

---

## The short version

The system underneath is genuinely well reasoned — the notch idiom, the reveal
vocabulary, the looping-carousel machinery, the reasoning in `Services` and `Hero`.
Nothing here argues with that. Four things are wrong:

1. **The site pays for two themes and ships one.** The band system, the `isDark` vetoes,
   the role/pigment split and 74 `data-band` attributes all exist to survive a theme flip
   that cannot happen. None of it runs.
2. **The elevation ladder doesn't separate.** Cards sit 1.19:1 off the page ground, which
   is why three sections reach for a border to define a card at all.
3. **Four consecutive sections show the same property photographs**, at the same point
   where the page's vertical rhythm splits in half.
4. **The hero is a fixed 1024px on every viewport**, which on a phone crops a 2.17:1
   panorama down to about 17% of its width.

Phase 1 is seven items. C1 is the largest by volume and the least risky — it is deletion.

---

## Measured contrast — dark, as shipped

`--color-content` is `#e9f0f3`. The three grounds are `base #0b1216` (the page),
`surface-alt #10191f` (a set-apart band), `surface #17242c` (cards and panels).

| | base | surface-alt | surface (cards) |
|---|---:|---:|---:|
| `text-content/70` | 8.33 PASS | 8.03 PASS | 7.42 PASS |
| `text-content/65` | 7.32 PASS | 7.09 PASS | 6.59 PASS |
| `text-content/60` | 6.38 PASS | 6.22 PASS | 5.83 PASS |
| `text-content/55` | 5.53 PASS | 5.42 PASS | 5.13 PASS |
| `text-content/50` | 4.77 PASS | 4.70 PASS | **4.49 FAIL** |
| `text-content/45` | **4.08 FAIL** | **4.05 FAIL** | **3.91 FAIL** |
| `text-content/40` | **3.47 FAIL** | **3.47 FAIL** | **3.39 FAIL** |
| `text-content/30` | **2.47 FAIL** | **2.51 FAIL** | **2.50 FAIL** |
| `text-content/25` | **2.08 FAIL** | **2.12 FAIL** | **2.13 FAIL** |

Live hardcoded values on their real grounds:

| Value | On | Ratio | Result |
|---|---|---:|---|
| `#6d7f9d` — testimonial role line | `#141e22` | 4.18 | **FAIL** |
| `#006a9d` — quote glyph | `#141e22` | 2.87 | decorative, `aria-hidden` |
| `#00a9ee` — testimonial eyebrow | base | 7.11 | PASS |
| `ember #fca42e` | base | 9.43 | PASS |
| `accent #63b4dc` | base | 8.17 | PASS |
| `accent #63b4dc` | surface (cards) | 6.86 | PASS |
| `text-bone/85` — hero lede | scrimmed sky | 3.78 | **FAIL** |

**Ground separation** — how far each surface sits off the one behind it:

| Pair | Ratio |
|---|---:|
| `surface #17242c` vs `base #0b1216` | 1.19 |
| `surface-alt #10191f` vs `base #0b1216` | ~1.06 |
| `#141e22` (testimonial card) vs base | 1.11 |

---

## Phase 1 — Critical

### C1 · The site pays for two themes and ships one

**Where:** `ThemeToggle.jsx` (orphaned) · `Navbar.jsx` (702 lines, ~35 direct references
plus the observer effect they feed) · 74 `data-band` attributes sitewide ·
`:root.dark` (~129 lines) · the theme-wipe CSS

`ThemeToggle` is imported by nothing. Light mode has no door. The consequence runs deeper
than a missing button:

- `onLight = overLight && !menuOpen && !isDark`. `isDark` is permanently `true`, so
  `onLight` is permanently `false`. **The entire band system never fires.** The
  IntersectionObserver, the strip geometry, the rebuild guard, `logoOnLight`, and the four
  chrome ternaries all compute a result that is thrown away every time.
- Seventy-four `data-band="light"` attributes mark sections for a system that does nothing.
- The role/pigment token split exists so a colour can survive a theme flip. With one theme
  it is a second name for the same value.

This is also why the missing `data-band` on `Testimonials.jsx:82` has never been noticed —
it is invisible because no other section's tag does anything either.

**Fix.** Delete rather than repair. In order:

1. Delete `ThemeToggle.jsx`.
2. Collapse `:root.dark` into `:root` and drop the `.dark` class from `<html>`, the boot
   script in `index.html`, and the `@custom-variant dark` binding.
3. Strip the band system from `Navbar` — `overLight`, `onLight`, `crossesStrip`, the strip
   constants, the observer effect, the rebuild guard, `logoOnLight`/`logoOnDark`, and the
   `idle`/`current`/`enquire`/`burger` ternaries collapse to their dark branch.
4. Remove the 74 `data-band` attributes.
5. Reduce `ThemeContext` to whatever `Navbar` and `floorplan/ModelViewer` still need — both
   read `isDark`, which becomes a constant.
6. Delete the theme-wipe CSS: the `theme-reveal` keyframe and `.theme-fade`.
7. Update DESIGN.md §6 (the band system) and the theming half of §1.

> **Flag for the build agent — step 6 needs care.** The bare
> `::view-transition-old(root)` / `::view-transition-new(root)` rules are shared: they also
> apply during the property route transition, which overrides them via
> `html.property-route-transition`. Fold what that transition needs into its own block
> before deleting the bare rules. The `html.property-route-transition::view-transition-*`
> rules are a different feature and stay.

If light mode is ever wanted back, it should be rebuilt from a working toggle rather than
maintained blind — a theme nobody can reach is a theme nobody is testing.

### C2 · `text-content/45` and below fail on the grounds that ship

**Where:** `LatestUpdates` platform + date labels ×3 · scroll label ·
`AcademyTeaser` index numerals · anything on `bg-surface` at `/50`

`/45` measures 4.08:1 on the page ground and 3.91:1 on a card. `/40` and `/30` are worse.
And because cards are `surface` rather than `base`, `/50` — which passes on the page —
**fails at 4.49:1 the moment the same class is used inside a card**, which is exactly where
most of the page's body copy lives.

The codebase already solved this problem once, for type on dark grounds, by replacing
opacity guesses with two named measured steps: `bone-2` and `bone-3`. Those tokens exist
and are correct. The landing sections just don't use them — they reach for
`text-content/NN` instead, at eleven different values.

**Fix.** Route secondary and tertiary type through the named steps rather than opacity:

```
text-content/60, /55  →  text-content-2   (bone-2 #afc0c9 — 5.79:1 worst case)
text-content/50, /45  →  text-content-3   (bone-3 #9bacb7 — 4.64:1 worst case)
```

`bone-2` and `bone-3` already hold their ratios on every rung of the ladder, which is what
`/50` does not. Treat any surviving `text-content/<55` as a lint error afterwards, the way
`bone/45` is now. `AcademyTeaser`'s index numeral at `/30` is called "information, not
decoration" in its own comment — it needs to clear 4.5:1 or become genuinely decorative.

### C3 · The elevation ladder doesn't separate

**Where:** `--color-base` / `--color-surface-alt` / `--color-surface`

A card sits **1.19:1** off the page ground. A `surface-alt` band sits about **1.06:1** off
it — effectively invisible. DESIGN.md rejected the previous family on exactly this basis:
"a 1.32:1 ratio end to end is not enough range for anything in it to read as sitting above
anything else." The revalue fixed the ladder's *ends* — it now spans 2.21:1 — but adjacent
rungs are still 1.06–1.19 apart, and adjacent rungs are the only ones anything actually
uses.

The evidence is in the components. `Properties`, `AvailableUnits` and `LatestUpdates` all
carry a border to define the card, and `Properties` says so outright: "the border is what
separates a card from the page ground behind it, which is nearly the same colour." Three
components independently working around the same token gap is the token gap being real.

**Fix.** Widen the gap between `base` and `surface` to about 1.5:1 — enough that a card
reads as raised without a border doing the work. Then either drop the borders or keep them
as deliberate emphasis on the one section that wants it, rather than as three separate
compensations. `surface-alt` needs the same treatment or it cannot serve the job R2 needs
it for.

### C4 · Testimonials is built outside the design system

**Where:** `Testimonials.jsx`

Reduced from the first draft — `#00a9ee` measures 7.11:1 on the dark ground and is fine —
but three problems are live:

- **`#6d7f9d` on `#141e22` is 4.18:1** at 12px. Real AA failure, shipping now.
- **`md:whitespace-nowrap` on a CMS-driven `h2`** will push the heading past the viewport
  the first time an editor writes a longer one.
- **`#141e22` sits 1.11:1 off the page ground** — the card is doing nothing that
  `bg-surface` wouldn't do better, and it is a sixth hardcoded hex in one component
  alongside `#00a9ee`, `#006a9d`, `#6d7f9d`, `#ffb000` and `text-white/92`.

Its eyebrow is set `12px / 500 / 0.04em` against the page's canonical
`11px / 700 / 0.28em`, and its radius is `rounded-[20px]` — which is `rounded-panel`,
spelled out.

**Fix.** Rebuild on tokens: `SectionIntro` for the header, `bg-surface` for the cards,
`rounded-panel`, `text-ember` for the stars, `text-accent` for the quote glyph,
`text-content-2` for the role line. Drop `md:whitespace-nowrap` — `text-balance` already
does the job the author wanted without the overflow risk.

### C5 · The same property photographs run four sections deep

**Where:** `AvailableUnits` · `Properties` · `Gallery` — all three read `useProperties()`
and take the first N

`Properties` renders `useProperties().slice(0, 3)`. `Gallery`, two sections later, renders
`properties.filter(p => p.image).slice(0, 4)` — so its first three tiles are the same three
photographs, in the same order, that the visitor scrolled past moments earlier.
`AvailableUnits`, between them, uses `property.image` on every card, which is the same set a
third time. Add `FeaturedProperty` above them and the page spends four consecutive sections
on one photo library.

Each section's reasoning is sound in isolation — that's exactly how this happens. Seen as a
page, it reads as a site with three properties rather than a portfolio.

**Fix.** Either give `Gallery` an offset so it draws from properties the teaser above did
not show (`properties.filter(p => p.image).slice(3, 7)`), or move `Gallery` above
`FeaturedProperty` so the mosaic is the establishing shot and the cards are the detail. The
offset is the smaller change and solves it outright.

> **Flag for the build agent:** if the portfolio holds fewer than seven properties with
> images, the offset falls back to an empty section and the reorder is the correct fix
> instead.

### C6 · The hero is a fixed 1024px on a 390px phone

**Where:** `Hero.jsx:150` — `h-256`, no responsive override

The comment explains the fixed height well: the hero is a fixed object, not a responsive
one, and everything measured in `dvh` was correctly removed to match. That reasoning holds
on desktop. On a phone it produces two problems. The hero becomes 1.2 viewports tall, so the
visitor scrolls a full screen of photograph before reaching anything — and because these are
2.17:1 panoramas, `object-cover` into a 390×1024 frame scales the image to 2222px wide and
shows roughly 17% of it. The building the photograph was taken for is not in frame.

**Fix.** Keep the fixed frame from `md` up, where it is doing real work, and let the phone
have a frame proportional to its own screen: `h-[min(88dvh,44rem)] md:h-256`. That restores
a sane crop and puts the fold back below the CTA rather than a screen past it. The `dvh`
terms removed from the type do not need to come back — the copy block is top-anchored at
`pt-[8rem]` and clears comfortably at 88dvh.

### C7 · The hero lede's contrast math omits its own opacity

**Where:** `Hero.jsx:294` — `text-bone/85`

Theme-independent: the hero sits on a photograph, not a theme ground, so this ships in dark
exactly as measured.

The `VEIL` comment works the stacked-alpha compositing out correctly — `1-(1-a₁)(1-a₂)`
gives 0.56 over a blown-out white sky, and that does clear 4.5:1 for *opaque* white type.
But the type is `text-bone/85`, not `bone`. At 85% the actual ratio is 3.78:1. The reasoning
was right; the `/85` was applied after the arithmetic.

**Fix.** Drop the opacity to `text-bone` (4.53:1 — clears, if narrowly), or keep `/85` and
deepen the `VEIL` centre stop from `0.34` to about `0.44`. The first is free; the second
costs a little of the photograph. Either way, re-measure against a white sky, not against
the current slide.

---

## Phase 2 — Refinement

Nothing here is broken. All of it is drift — the page arriving at four answers to questions
the system already answered once.

### R1 · Vertical rhythm splits the page in half

`FeaturedProperty`, `AvailableUnits` and `Properties` run at `py-6` (24px). `Gallery`,
`Services`, `AcademyTeaser`, `Testimonials` and `LatestUpdates` run at `py-20 md:py-28`
(80–112px). The page's first half is compressed into one continuous mass while its second
half breathes — and because all eight share `bg-base`, there is nothing else marking where
one section ends and the next begins. The three tight sections read as one very long section.

**Fix.** Pick two section-padding steps and put every section on one of them, the same way
the gutter is two values rather than a scale. Suggest `py-14 md:py-20` for sections that are
deliberately close-coupled (Featured → Properties is a real sequence) and `py-20 md:py-28`
for the rest. Add both as tokens — `--spacing-section` and `--spacing-section-tight` — so
the next section cannot invent a third.

### R2 · The page has no chapter breaks, and alternating grounds cannot provide them

Eight of nine sections stand on `bg-base`; only `Partners` differs (`bg-void`). Ten
sections, one ground, and the visitor's only cue that they have moved on is that the content
changed.

The obvious fix — alternate `bg-surface-alt` — does not work at current values. It sits
~1.06:1 off `base`, which will read as nothing. **This depends on C3.** Widen the ladder
first, then alternate; attempting it beforehand produces a change nobody can see.

**Fix.** After C3, put `Services` and `Testimonials` on `bg-surface-alt` to give the page
three chapters — properties / capabilities / proof — without adding a single element. If
C3 is deferred, use rhythm instead of ground: a wider `py` step at the two hinges is a
weaker signal but a visible one.

### R3 · Five heading scales, and the largest is on the least important section

| Component | Clamp |
|---|---|
| `SectionIntro` | `clamp(1.75rem, 3.1vw, 2.85rem)` |
| `AvailableUnits` | `clamp(1.7rem, 3vw, 2.5rem)` |
| `Gallery` | `clamp(1.6rem, 2.5vw, 2.4rem)` — justified, third-width column |
| `Testimonials` | `clamp(2rem, 3.15vw, 3rem)` |
| `FeaturedProperty` | `clamp(1.5rem, 2.1vw, 2.2rem)` — justified, narrow column |

`AvailableUnits` at 2.5rem and `SectionIntro` at 2.85rem are both full-width centred headings
and have no reason to differ. `Testimonials` carries the largest `h2` on the page, which
inverts the hierarchy: social proof is announced louder than the portfolio. The `--text-h2`
token that exists for this is used nowhere.

**Fix.** Route every full-measure section heading through `SectionIntro` — that means
`AvailableUnits` and `Testimonials` adopting it rather than hand-rolling. Keep the two
documented narrow-column exceptions and note them in DESIGN.md §2 so they read as decisions
rather than drift. Either retire `--text-h2` or repoint it at `SectionIntro`'s clamp; an
unused token in a tree-shaken theme is a trap.

### R4 · Five eyebrow settings, and the `.eyebrow` utility is used by none of them

| Where | Setting |
|---|---|
| `SectionIntro` / `FeaturedProperty` / `AvailableUnits` | `11px · 700 · 0.28em · accent` |
| `Partners` | `0.72rem→0.8rem · 700 · 0.22em · accent-soft` |
| `Testimonials` | `12px · 500 · 0.04em · #00a9ee` |
| `LatestUpdates` | `12px · 700 · 0.16em · content/45` |

The kicker is the page's most repeated typographic device and it is set four different ways.
Meanwhile `.eyebrow` and `--text-eyebrow` both exist in `index.css`, agree with the canonical
setting, and are used only by loading states and interior pages — zero landing sections.

**Fix.** Move the rule-flanked kicker into `SectionIntro` as the only way to draw one, and
have it use `.eyebrow` rather than restating the four properties. `Partners` keeps its
gradient rules — it is on a dark ground and the treatment is different on purpose — but
should still take its size and tracking from the token.

### R5 · Four consecutive sections all end in a link to `/properties`

- Hero → `#properties`
- `AvailableUnits` → "View all properties"
- `Properties` cards → `/properties/:slug`
- `Gallery` → "See more projects"

Four separate affordances, in four different visual registers, pointing at the same
destination within one scroll. Repetition at that density stops reading as emphasis and
starts reading as the page not knowing what it wants.

**Fix.** Keep the one with the most visual weight and the best position — Gallery's
full-width slab, which is that section's only action and the last thing in its reading order.
Drop `AvailableUnits`' "View all properties" ghost button; its cards already link into the
same place. One element removed, nothing lost.

### R6 · Card radius drifts across the page

`rounded-panel` ×7 · `rounded-frame` ×3 · `rounded-[20px]` · `rounded-2xl`

`Properties`, `AvailableUnits` and `Gallery` draw cards at `rounded-panel` (20px).
`FeaturedProperty` and `LatestUpdates` draw the same object at `rounded-frame` (32px).
`Testimonials` writes `rounded-[20px]`, and the Properties chip row uses `rounded-2xl`, which
is neither. The radii are named by job precisely so a card and a photographic frame cannot
drift — here the card itself has drifted.

**Fix.** Cards are `rounded-panel`. `rounded-frame` is for the photographic frame and the
featured panel — the objects deliberately larger than a card. Replace `rounded-[20px]` and
`rounded-2xl` with the tokens they are approximating.

### R7 · Hairlines bypass the token that exists for them

`border-content/{10,15,20,25,30,35,50}` — 47 call sites, against 23 for `border-line`.

Under one theme these land close to each other in value, so this is consolidation rather than
a correctness fix — but seven hairline weights on one page is still seven, and `--color-line`
is the token that names the job.

**Fix.** Collapse to `border-line` for ordinary division and add one `--color-line-firm` for
the emphatic rule the `/25`–`/35` sites are reaching for. Two weights. Folds naturally into
C1's token cleanup.

---

## Phase 3 — Polish

### P1 · Three entrance animations stack on the same elements

- `LandingParallaxChapter` — spring-damped `y` drift
- `SectionRevealController` — opacity + clip-path + `blur(7px)`
- GSAP card staggers in `Properties` and `AvailableUnits`

Every landing section is wrapped in a parallax chapter, tagged by the reveal controller, and —
in two cases — additionally runs its own GSAP stagger. So a section arrives blurred,
un-clipping, drifting on a spring, while its cards stagger upward inside it. Individually each
is well judged. Together they read as softness rather than as intent, and the `blur(7px)` on a
full-width section containing photographs is the most expensive of the three by a wide margin.
Nine chapters also carry `will-change: transform` permanently rather than for the duration of
the animation.

**Fix.** Pick one entrance per section. The reveal controller is the right one to keep — it is
the page-wide vocabulary — and the two GSAP staggers should be the exception, earned by the
sections whose content genuinely benefits from sequencing. Drop the blur from the reveal, or
reduce it to 2–3px; the clip-path and opacity already carry the gesture. Set `will-change` from
the animation rather than as a resting class.

### P2 · Two horizontal rails, two different affordances

`Testimonials` gives a `tabIndex={0}` scroller and a thin scrollbar. `LatestUpdates`, directly
below, gives prev/next buttons that disable correctly at each end — genuinely good work. On a
trackpad-less desktop the first one has no visible way to advance.

**Fix.** Lift `LatestUpdates`' rail header — the label, the two buttons, the `railPosition`
logic — into a shared `CardRail` and have both sections use it. One rail component, one
behaviour, and the next horizontal list on the site inherits both.

### P3 · The hero carousel has no transport at all

Six slides, 6.5s dwell, no dots or arrows. The comment is candid that this is deliberate: the
design draws no controls, and the slow crossfade is doing the work of telling the visitor there
is more than one property. It nearly succeeds. But at 6.5 seconds per slide, most visitors will
scroll past having seen one — and there is no way to know a second exists, let alone reach it.

**Fix.** The lightest thing that resolves it without adding chrome the comp doesn't draw: a row
of thin progress rules, bottom-left, one per slide, with the active one filling over the dwell.
It reads as a timing indicator rather than as controls, costs about twelve lines, and makes the
set legible. Make them buttons and it also becomes reachable. If the client's position is
genuinely no controls, keep the rules non-interactive — the count is the part that's missing.

### P4 · The page assembles itself in front of the visitor

Every section returns `null` until its CMS row lands, which is the right call and the comments
defend it well. The side effect is that on a cold load the page grows section by section as data
arrives — which is also why `App.jsx` refreshes ScrollTrigger on mount, on `load`, and again on
`fonts.ready`. `AvailableUnits` is the only section on the page with a designed empty state.

**Fix.** Reserve height for the sections whose shape is known before their content is — a card
rail is always the same height whatever six cards it holds. A `min-h` on those containers stops
the document from resizing under the scroll triggers and removes most of what the three refreshes
are compensating for. No skeleton shimmer; just a box that already knows how big it is.

### P5 · Focus indicators are complete but drawn two ways

`focus-visible:ring-2 + ring-offset` in `PrimePill`; `focus-visible:outline-2 + outline-offset`
in `ActionButton`, `Gallery`, `AcademyTeaser`, `LatestUpdates`.

Genuine credit here: every interactive element on the page has a focus state, the decorative
arrow disc on the property cards is correctly `aria-hidden` rather than a second tab stop, and
the reasoning for `outline` over `ring` on photography is right. The inconsistency is only that
both idioms are in use for the same job on the same ground, and `ring-offset` paints in the
colour behind the element — which becomes simpler, not harder, once C1 removes the second theme.

**Fix.** Standardise on `outline`, which needs no knowledge of what is behind it. Keep `ring`
only where a shadow-based indicator is genuinely required. Define the pair once as a utility so
a new component cannot pick a third.

---

## Design system changes required

Mostly deletion. The one addition is a wider ladder.

| Change | Detail |
|---|---|
| **Delete** `:root.dark` | ~129 lines. Collapse its values into `:root`; drop the `.dark` class, the boot script branch, and `@custom-variant dark`. |
| **Delete** the band system | 74 `data-band` attributes, plus `overLight`/`onLight`/`crossesStrip`/the observer effect/the chrome ternaries in `Navbar`. |
| **Delete** `ThemeToggle.jsx` | Orphaned already. |
| **Delete** the theme-wipe CSS | `theme-reveal` keyframe and `.theme-fade`. See the C1 caveat about the shared `::view-transition-*(root)` rules. |
| **Widen** `base` → `surface` | To ~1.5:1, from 1.19. A card should read as raised without a border doing the work. `surface-alt` needs the same, or R2 cannot use it. |
| **Adopt** `content-2` / `content-3` | The `bone-2` / `bone-3` steps already exist and already hold their ratios. Retire `text-content/NN` below `/55`. |
| **Add** `--color-line-firm` | The emphatic hairline the `/25`–`/35` sites are reaching for. |
| **Add** `--spacing-section` / `-tight` | Two section-padding steps, not a scale — the discipline `--spacing-gutter` already applies horizontally. |
| **Resolve** `--text-h2` | Unused. Retire it or repoint it at `SectionIntro`'s clamp. |

---

## What not to touch

An audit that only lists faults misrepresents the page. These look unusual and are correct; a
later pass should not "fix" them.

- **The masked-heading reveal as CSS rather than JS.** A masked word rests outside its box, so a
  reveal that fails to run leaves the headline permanently invisible. A keyframe cannot fail to
  run. Right trade, keep it.
- **`mode="wait"` on the page transition.** It buys the one frame with nothing mounted, which is
  the only moment the scroll reset can happen unseen. Not decorative.
- **The alpha-mask fade at the hero's foot.** Ramping a gradient to `transparent` passes through
  grey in sRGB. Masking a `bg-base` element instead is correct.
- **Sections returning `null` on empty CMS rows.** An empty bordered slab is worse than no
  section. P4 reserves height; it does not reinstate shells.
- **The decorative arrow disc on property cards being `aria-hidden`.** The stretched link already
  covers the card. A second tab stop to the same destination would be a regression.
- **Photographs instead of icon tiles in `Services`.** The reasoning in that component — that an
  icon of a chair is not evidence of an interiors practice — is the best design argument in the
  codebase.
- **The property route transition's view-transition CSS.** Different feature from the theme wipe.
  C1 deletes one and must leave the other standing.
