import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react'

export default function LandingParallaxChapter({ children, depth = 32, className = 'bg-base' }) {
  const chapterRef = useRef(null)
  const reducedMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: chapterRef,
    offset: ['start end', 'end start'],
  })

  const rawY = useTransform(scrollYProgress, [0, 0.5, 1], [depth, 0, -depth])
  const y = useSpring(rawY, {
    stiffness: 72,
    damping: 24,
    mass: 0.45,
    restDelta: 0.01,
  })

  return (
    <div ref={chapterRef} className={'relative overflow-clip ' + className}>
      <motion.div style={reducedMotion ? undefined : { y }} className="will-change-transform">
        {children}
      </motion.div>
    </div>
  )
}
