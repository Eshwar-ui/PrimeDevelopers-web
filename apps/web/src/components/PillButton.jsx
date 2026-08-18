import { motion } from 'motion/react'
import ArrowRight from './ArrowRight'

// Shared CTA. Hover choreography: spring lift + a bottom-origin color flood,
// label advance, and a directional arrow handoff. Tap presses in.
//   accent → electric blue      ink → carbon on light bands
//   bone   → light pill on dark  ember → warm signal CTA
const variants = {
  accent: 'bg-accent text-white dark:text-void',
  ember: 'bg-ember text-void',
  ink: 'bg-ink text-bone',
  bone: 'bg-bone text-void',
  prime: 'bg-prime text-white dark:text-void', // CG Blue — Prime Developer light theme
  outline: 'border border-content/25 bg-transparent text-content',
}


export default function PillButton({
  href,
  children,
  variant = 'accent',
  className = '',
  onClick,
}) {
  return (
    <motion.a
      href={href}
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.975 }}
      transition={{ type: 'spring', stiffness: 460, damping: 28 }}
      className={`group relative inline-flex items-center overflow-hidden rounded-full px-6 py-3.5 font-body text-[14px] font-bold uppercase tracking-[0.1em] outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-3 focus-visible:ring-offset-surface motion-reduce:transform-none ${variant === 'outline' ? '' : 'primary-button-flood'} ${variants[variant]} ${className}`}
    >
      <span className="relative flex items-center gap-2">
        <span className="transition-transform duration-200 ease-brand group-hover:translate-x-0.5 motion-reduce:transform-none">
          {children}
        </span>
        <span aria-hidden="true" className="relative size-5 overflow-hidden">
          <ArrowRight className="absolute inset-0 size-5 transition-transform duration-300 ease-brand group-hover:translate-x-6 group-hover:-translate-y-1 motion-reduce:transform-none" />
          <ArrowRight className="absolute inset-0 size-5 -translate-x-6 translate-y-1 transition-transform duration-300 ease-brand group-hover:translate-x-0 group-hover:translate-y-0 motion-reduce:hidden" />
        </span>
      </span>
    </motion.a>
  )
}
