import { motion } from 'motion/react'
import ArrowRight from './ArrowRight'

// Shared CTA. Hover choreography: spring lift + a fill that sweeps up from the
// bottom edge + the arrow sliding right. Tap presses in.
export default function PillButton({ href, children, variant = 'accent', className = '', onClick }) {
  const bg = variant === 'ink' ? 'bg-ink' : 'bg-accent'

  return (
    <motion.a
      href={href}
      onClick={onClick}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={`group relative inline-flex items-center overflow-hidden rounded-full ${bg} px-6 py-3.5 font-body text-[15px] font-bold tracking-wide text-bone ${className}`}
    >
      {/* fill sweep */}
      <span className="absolute inset-0 translate-y-full bg-bone/20 transition-transform duration-300 ease-out group-hover:translate-y-0" />
      <span className="relative flex items-center gap-1.5">
        {children}
        <ArrowRight className="size-6 transition-transform duration-300 ease-out group-hover:translate-x-1.5" />
      </span>
    </motion.a>
  )
}
