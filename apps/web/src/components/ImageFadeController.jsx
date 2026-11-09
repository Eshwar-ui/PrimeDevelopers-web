import { useLayoutEffect } from 'react'

/**
 * Photographs fade in as they finish loading instead of popping in.
 *
 * Any `<img>` inside `<main>` that is not yet decoded when it is found is held
 * at opacity 0, then brought up over 500ms from a light blur when it loads.
 * An image that is already complete (cached, or the eager hero) is left alone,
 * so nothing that could already be seen is ever hidden.
 *
 * WAAPI with an implicit end keyframe: the animation runs *to* whatever the
 * stylesheet says, so a deliberately faint image (a watermark at
 * `opacity-25`) lands at 25%, not 100%. It also never touches `transform`,
 * `translate` or `scale`, which the hover zooms and the scroll unveil own.
 *
 * The hiding is an inline style set by script, so if this never runs nothing
 * is hidden; a failed load is shown at once rather than left as a hole.
 * Only `loading="lazy"` images take part; `data-no-fade` on an image or an
 * ancestor opts it out.
 */
export default function ImageFadeController() {
  useLayoutEffect(() => {
    const root = document.querySelector('main')
    if (!root) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const seen = new WeakSet()

    const reveal = (img) => {
      img.style.removeProperty('opacity')
      img.animate([{ opacity: 0, filter: 'blur(8px)' }, {}], {
        duration: 500,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      })
    }

    const register = () => {
      root.querySelectorAll('img').forEach((img) => {
        if (seen.has(img)) return
        seen.add(img)
        // Lazy images only: an eager one is above the fold by intent (the
        // hero), and its first paint is not ours to delay.
        if (img.complete || img.loading !== 'lazy' || img.closest('[data-no-fade]')) return
        img.style.opacity = '0'
        const done = () => {
          img.removeEventListener('load', done)
          img.removeEventListener('error', fail)
          reveal(img)
        }
        const fail = () => {
          img.removeEventListener('load', done)
          img.removeEventListener('error', fail)
          img.style.removeProperty('opacity')
        }
        img.addEventListener('load', done)
        img.addEventListener('error', fail)
      })
    }

    register()
    const observer = new MutationObserver(register)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
