import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefersReducedMotion, dealCards } from './reveal'

gsap.registerPlugin(ScrollTrigger)

/**
 * The site's Apple-style finishing layer, mounted once on `<main>` so every
 * public page gets it. Two things, neither of which moves a box or changes a
 * size at rest:
 *
 * 1. **Photo unveil.** A card photograph settles from a slight push-in to
 *    rest as its frame scrolls up into view, scrubbed to the scroll so it runs
 *    back on the way up. The scale lives in a custom property applied through
 *    `transform` (index.css), which is deliberately *not* the property the hover
 *    zoom uses: Tailwind v4's `group-hover:scale-*` writes the individual
 *    `scale` property, so the two multiply instead of fighting, and the CSS
 *    narrows the img's transition to `scale` so the scrubbed value is never
 *    eased a second time on top of Lenis.
 *
 *    Which photographs: any marked `data-unveil`, plus — so no page has to opt
 *    in — any `img` carrying a `group-hover:scale-*` class, which on this site
 *    is exactly the card photo sitting in its own clipped frame. A photo inside
 *    a `[data-parallax]` layer is skipped (that layer already moves it), and
 *    `data-no-unveil` on the image or an ancestor opts out.
 *
 * 2. **Press.** Every link and button answers a press by sinking a few pixels
 *    — the same depth whatever its size, so a pill and a full card feel like
 *    one material. Driven by WAAPI on the `scale` property, which no
 *    transition list can delay and which composes with the `translate` hover
 *    lifts and GSAP's inline `transform`. Elements that already carry their own
 *    `active:scale-*` are left to it.
 *
 * Both re-scan on DOM changes, because most of the page's photographs arrive
 * from the CMS after mount.
 */
export function initSiteMotion(root) {
  if (!root || prefersReducedMotion()) return () => {}

  /* ── Photo unveil ───────────────────────────────────────────── */
  const unveiled = new Map()

  const scanUnveil = () => {
    let added = false
    root.querySelectorAll('img[data-unveil], img[class*="group-hover:scale-"]').forEach((img) => {
      if (unveiled.has(img)) return
      if (img.closest('[data-parallax], [data-no-unveil]')) return
      // The CSS rule keys on the attribute, so an auto-picked photo gets it too.
      img.setAttribute('data-unveil', '')
      const frame = img.parentElement ?? img
      const tween = gsap.fromTo(
        img,
        { '--unveil': 1.12 },
        {
          '--unveil': 1,
          ease: 'none',
          scrollTrigger: { trigger: frame, start: 'top bottom', end: 'top 35%', scrub: true },
        }
      )
      unveiled.set(img, tween)
      added = true
    })
    // Drop tweens whose image React has since thrown away.
    unveiled.forEach((tween, img) => {
      if (img.isConnected) return
      tween.scrollTrigger?.kill()
      tween.kill()
      unveiled.delete(img)
    })
    if (added) ScrollTrigger.refresh()
  }

  /* ── Press ──────────────────────────────────────────────────── */
  const DEPTH = 6 // px the longer side gives up under a press
  const pressable = 'a[href], button:not(:disabled), [role="button"], [role="link"]'
  let pressed = null
  let pressAnim = null

  const pressScale = (el) => {
    const { width, height } = el.getBoundingClientRect()
    const side = Math.max(width, height, 1)
    return Math.min(0.985, Math.max(0.94, 1 - DEPTH / side))
  }

  const release = () => {
    if (!pressed) return
    const el = pressed
    const from = getComputedStyle(el).scale
    pressAnim?.cancel()
    pressAnim = null
    pressed = null
    el.animate([{ scale: from === 'none' ? '1' : from }, { scale: '1' }], {
      duration: 420,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    })
  }

  const onDown = (e) => {
    if (e.button !== 0) return
    const el = e.target.closest?.(pressable)
    if (!el || !root.contains(el) || /\bactive:scale/.test(el.className?.baseVal ?? el.className ?? '')) return
    release()
    pressed = el
    pressAnim = el.animate([{ scale: '1' }, { scale: String(pressScale(el)) }], {
      duration: 140,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      fill: 'forwards',
    })
  }

  /* ── Card deal ──────────────────────────────────────────────
     Any container marked `data-deal` has its children dealt in one after the
     other, row by row, exactly like the homepage cards (lib/reveal
     `dealCards`). Declarative so a page needs no effect of its own: mark the
     grid and it moves. Children that arrive later — a filter, a CMS fetch —
     are dealt as they appear; ones already shown are left alone, so a filter
     change never makes the cards still on screen blink. */
  const dealt = new WeakSet()
  const deals = []

  const scanDeal = () => {
    root.querySelectorAll('[data-deal]').forEach((grid) => {
      const fresh = Array.from(grid.children).filter((c) => !dealt.has(c))
      if (!fresh.length) return
      fresh.forEach((c) => dealt.add(c))
      // `data-deal="rows"` for a list of text rows: a shorter rise and a
      // tighter step, since 56px under a line of type reads as a jump.
      const rows = grid.dataset.deal === 'rows'
      const deal = dealCards(fresh, rows ? { y: 20, step: 0.05 } : undefined)
      if (deal) deals.push(deal)
    })
  }

  root.addEventListener('pointerdown', onDown)
  window.addEventListener('pointerup', release)
  window.addEventListener('pointercancel', release)
  window.addEventListener('dragstart', release)

  scanUnveil()
  scanDeal()
  let queued = false
  const observer = new MutationObserver(() => {
    // Synchronously: a MutationObserver callback runs before the next paint,
    // so a new card is hidden before it is ever drawn rather than flashing up
    // and then dropping out to make its entrance.
    scanDeal()
    if (queued) return
    queued = true
    // A timer, not rAF: rAF never fires in a tab that is not rendering
    // (DESIGN.md §9), which would leave late photographs unregistered.
    setTimeout(() => {
      queued = false
      scanUnveil()
    }, 50)
  })
  observer.observe(root, { childList: true, subtree: true })

  return () => {
    observer.disconnect()
    root.removeEventListener('pointerdown', onDown)
    window.removeEventListener('pointerup', release)
    window.removeEventListener('pointercancel', release)
    window.removeEventListener('dragstart', release)
    pressAnim?.cancel()
    unveiled.forEach((tween, img) => {
      tween.scrollTrigger?.kill()
      tween.kill()
      img.style.removeProperty('--unveil')
    })
    unveiled.clear()
    deals.forEach((d) => d.kill())
  }
}
