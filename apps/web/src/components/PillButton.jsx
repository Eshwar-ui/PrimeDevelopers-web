import { motion } from 'motion/react'
import ArrowRight from './ArrowRight'

// Shared CTA. Hover choreography: spring lift + a fill that sweeps up from the
// bottom edge + the arrow sliding right. Tap presses in.
//   accent → electric blue      ink → carbon on light bands
//   bone   → light pill on dark  ember → warm signal CTA
const variants = {
  accent: 'bg-accent text-white dark:text-void',
  ember: 'bg-ember text-void',
  ink: 'bg-ink text-bone',
  bone: 'bg-bone text-void',
  prime: 'bg-prime text-white', // CG Blue — Prime Developer light theme
  outline: 'border border-content/25 bg-transparent text-content',
}

const sweep = {
  accent: 'bg-void/25',
  ember: 'bg-void/25',
  ink: 'bg-bone/20',
  bone: 'bg-void/15',
  prime: 'bg-white/20',
  outline: 'bg-content/8',
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
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={`group relative inline-flex items-center overflow-hidden rounded-full px-6 py-3.5 font-body text-[14px] font-bold uppercase tracking-[0.1em] ${variants[variant]} ${className}`}
    >
      {/* fill sweep */}
      <span
        className={`absolute inset-0 translate-y-full transition-transform duration-300 ease-out group-hover:translate-y-0 ${sweep[variant]}`}
      />
      <span className="relative flex items-center gap-1.5">
        {children}
        <ArrowRight className="size-5 transition-transform duration-300 ease-out group-hover:translate-x-1.5" />
      </span>
    </motion.a>
  )
}
