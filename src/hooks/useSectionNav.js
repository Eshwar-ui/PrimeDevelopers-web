import { useNavigate, useLocation } from 'react-router-dom'
import { lenis } from './useSmoothScroll'

// Unified internal navigation:
//   '/about', '/'        → route (with '/' also scrolling to top when already home)
//   '#properties', '#…'    → smooth-scroll to a home-page section, navigating home first
export function useSectionNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (target) => {
    if (target === '/') {
      if (pathname !== '/') navigate('/')
      else lenis.current?.scrollTo(0)
      return
    }
    if (target.startsWith('/')) {
      navigate(target)
      return
    }
    // section anchor
    if (pathname !== '/') {
      navigate('/')
      setTimeout(() => lenis.current?.scrollTo(target, { offset: -20 }), 140)
    } else {
      lenis.current?.scrollTo(target, { offset: -20 })
    }
  }
}
