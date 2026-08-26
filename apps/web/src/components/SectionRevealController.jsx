import { useLayoutEffect } from 'react'

export default function SectionRevealController() {
  useLayoutEffect(() => {
    const root = document.querySelector('main')
    if (!root) return undefined

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const seen = new WeakSet()
    let revealObserver

    const reveal = (section) => {
      section.dataset.sectionReveal = 'revealed'
      revealObserver?.unobserve(section)
    }

    if (!reduced && 'IntersectionObserver' in window) {
      revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) reveal(entry.target)
          })
        },
        { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
      )
    }

    const register = () => {
      root.querySelectorAll('section').forEach((section) => {
        if (seen.has(section) || section.dataset.sectionReveal === 'off') return
        seen.add(section)

        const alreadyVisible = section.getBoundingClientRect().top < window.innerHeight * 0.82
        if (reduced || !revealObserver || alreadyVisible) {
          reveal(section)
          return
        }

        section.dataset.sectionReveal = 'pending'
        revealObserver.observe(section)
      })
    }

    register()
    const mutationObserver = new MutationObserver(register)
    mutationObserver.observe(root, { childList: true, subtree: true })

    return () => {
      mutationObserver.disconnect()
      revealObserver?.disconnect()
    }
  }, [])

  return null
}