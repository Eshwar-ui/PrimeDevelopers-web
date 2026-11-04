import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin, CustomEase)

// The JS twin of `--ease-brand`. DESIGN.md §5 names three curves so the next
// component cannot invent a fourth that is almost the same — but that only held
// for CSS, because every GSAP tween in the codebase reaches for `power3.out`,
// which is close to the token and not equal to it. A heading rising on
// power3.out beside a card rising on ease-brand is exactly the "merely similar"
// that naming the curves was meant to prevent. The control points are lifted
// straight off `cubic-bezier(0.16, 1, 0.3, 1)`.
CustomEase.create('brand', 'M0,0 C0.16,1 0.3,1 1,1')

// Shared with MaskedHeading rather than restated: the hero's masked rise and a
// section heading's masked rise are the same gesture happening at different
// depths of the page, and they have to agree to read that way.
const WORD_STAGGER = 0.052

/**
 * The reveal vocabulary, keyed by the value of `data-text-reveal`.
 *
 * Each entry is a complete motion, not a set of knobs — the point of naming
 * them is that a component picks a reveal rather than describing one, which is
 * what keeps a single page from ending up with four text effects on it.
 *
 * `mask` is what makes these different from a fade: SplitText clones each piece
 * into a wrapper clipped to its own box, so the type rises out from behind the
 * line above instead of materialising in place. A word has somewhere to come
 * from.
 */
const VARIANTS = {
  // Headings. Per-word, matching the hero — line breaks belong to the browser
  // and re-wrap at every breakpoint, so a mask cut to lines would be wrong the
  // moment the viewport changed.
  words: {
    type: 'words',
    mask: 'words',
    target: 'words',
    from: { yPercent: 112 },
    duration: 0.9,
    stagger: WORD_STAGGER,
  },

  // Body copy. Per-line here precisely because a lede is read as lines rather
  // than as a phrase — per-word across four lines of 15px type is 40-odd pieces
  // of separate movement, which reads as noise. `autoSplit` re-cuts these when
  // the font loads or the column changes width, which is the whole reason line
  // splitting is safe to use at all.
  lines: {
    type: 'lines',
    mask: 'lines',
    target: 'lines',
    from: { yPercent: 100, opacity: 0 },
    duration: 0.95,
    stagger: 0.08,
  },

  // Reserved for short, large, deliberate type — a two-word kicker, a pull
  // quote. Unmasked and faded, because a character cascade behind a clip at
  // display size draws attention to the mask rather than the word. Never put
  // this on a sentence.
  chars: {
    type: 'chars,words',
    mask: undefined,
    target: 'chars',
    from: { yPercent: 60, opacity: 0 },
    duration: 0.7,
    stagger: 0.018,
  },
}

/**
 * Builds the scroll-triggered reveal for one element.
 *
 * Why this is allowed to be JS when the hero's reveal deliberately is not
 * (DESIGN.md §5): a masked word's resting position is outside its own box, so
 * anything that hides the type before animating it has to be certain the
 * animation runs. The hero cannot take that bet — it is the first paint, and a
 * headline that fails to appear is the whole page failing. Below the fold the
 * bet is already taken and already won: sixteen components hide and reveal
 * themselves through ScrollTrigger today.
 *
 * The hiding also happens *inside* `onSplit`, not in a stylesheet, which is the
 * part that matters. If the bundle never loads, if GSAP throws, if the plugin
 * is missing — nothing ran, nothing was hidden, and the text is simply there.
 * The failure mode is "no animation", never "no words".
 */
export function revealText(el) {
  const spec = VARIANTS[el.dataset.textReveal] ?? VARIANTS.words

  // Survives the re-split. `autoSplit` rebuilds the pieces when the webfont
  // lands or the line box changes width, and calls `onSplit` again each time —
  // without this, resizing the window a minute later would re-hide a heading
  // the reader is in the middle of reading and play it back at them.
  let played = false

  return SplitText.create(el, {
    type: spec.type,
    mask: spec.mask,
    autoSplit: true,
    // Puts the original string on the parent as an aria-label and hides the
    // pieces from the accessibility tree. Without it a split heading is read
    // out one fragment at a time, and `chars` is read out letter by letter.
    aria: 'auto',
    wordsClass: 'pd-word',
    linesClass: 'pd-line',
    charsClass: 'pd-char',
    onSplit(self) {
      if (played) return undefined
      const targets = self[spec.target]
      if (!targets.length) return undefined

      return gsap.from(targets, {
        ...spec.from,
        duration: spec.duration,
        ease: 'brand',
        stagger: spec.stagger,
        delay: Number(el.dataset.textRevealDelay) || 0,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        onComplete: () => {
          played = true
          // A `.from()` leaves its inline transform behind permanently, and an
          // inline style always beats a utility class (DESIGN.md §9).
          gsap.set(targets, { clearProps: 'transform,opacity' })
        },
      })
    },
  })
}

/**
 * Decodes a figure into place, for `data-scramble`.
 *
 * Kept away from the split variants because it is not a reveal — it is a
 * treatment for a figure that has already arrived, and it belongs only on type
 * set in `.numeral`. On a word it reads as a cipher gimmick; on a statistic it
 * reads as the figure being counted.
 *
 * Distinct from CountUp, which climbs through every value on the way: use that
 * where the quantity is the point and the reader should feel it accumulate,
 * this where the figure is a fixed fact that should feel resolved rather than
 * reached. The two must never appear in the same stat block.
 *
 * Only the alphanumeric runs are scrambled. Left to itself the plugin churns
 * the whole string, and the figures this lands on are not bare numbers —
 * `$4,250,000` spends its second as ten unbroken digits, losing the currency
 * mark and both separators, and `7.25%` stops being a percentage. Preserving
 * the punctuation keeps the shape of the figure legible the entire way through,
 * so what resolves is the value rather than the format. It also holds the width
 * steady: `.numeral` is tabular, so a run of digits is a fixed box, while a
 * comma standing in for a digit is not.
 */
export function scrambleText(el) {
  const text = el.textContent
  if (!text) return undefined

  // The element's text is about to become garbage for a second. A screen reader
  // on a live region would narrate every frame of it, so the real string goes
  // on as a label and the churn underneath is never announced.
  el.setAttribute('aria-label', text)

  // Held so the element can be handed back exactly as React rendered it. The
  // spans below are written straight into DOM that React owns, which is only
  // safe because these figures are static once loaded — and only stays safe
  // because the cleanup puts the original text back before any re-render.
  const original = el.innerHTML

  // A capturing split alternates separators and runs: "$4,250,000" becomes
  // ["$", "4", ",", "250", ",", "000", ""].
  const runs = []
  el.textContent = ''
  text.split(/([0-9A-Za-z]+)/).forEach((token, i) => {
    if (!token) return
    if (i % 2 === 0) {
      el.append(token)
      return
    }
    const span = document.createElement('span')
    span.textContent = token
    el.append(span)
    runs.push(span)
  })

  if (!runs.length) {
    el.innerHTML = original
    return undefined
  }

  const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 92%', once: true } })
  runs.forEach((span) => {
    const value = span.textContent
    tl.to(
      span,
      {
        duration: Number(el.dataset.scrambleDuration) || 1.1,
        ease: 'none',
        scrambleText: {
          text: value,
          // Matched to what the run actually is. Digits standing in for a
          // letter run reads as a number that turns out to be a word, and
          // letters standing in for digits reads as a bug.
          chars: /[0-9]/.test(value) ? '0123456789' : 'upperCase',
          speed: 0.6,
          revealDelay: 0.25,
        },
      },
      0
    )
  })

  return {
    revert() {
      tl.kill()
      el.innerHTML = original
      el.removeAttribute('aria-label')
    },
  }
}
