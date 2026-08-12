// Lone Star flag, inlined so the headline's state mark scales with the type
// and never waits on a network request. Drawn at 3:2, the official ratio.
export default function TexasFlag({ className = '' }) {
  return (
    <svg viewBox="0 0 3 2" className={className} aria-hidden focusable="false">
      <rect width="3" height="2" fill="#FFFFFF" />
      <rect x="1" y="1" width="2" height="1" fill="#BF0A30" />
      <rect width="1" height="2" fill="#002868" />
      <path
        d="M0.5 0.62 L0.588 0.879 L0.861 0.883 L0.643 1.046 L0.723 1.307 L0.5 1.15 L0.277 1.307 L0.357 1.046 L0.139 0.883 L0.412 0.879 Z"
        fill="#FFFFFF"
      />
    </svg>
  )
}
