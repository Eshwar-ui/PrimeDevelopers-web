import primeLogomark from '../assets/prime-logomark.svg'

/**
 * The mark resolves out of its own silhouette on a loop, so the animation reads
 * as composed whether it runs for one second or forty. That matters here: the
 * API sleeps when idle and a cold start can take upwards of half a minute, so
 * this screen has no fixed duration to design against.
 *
 * `hint` is the honest version of a progress bar. There is nothing to measure —
 * the server either answers or it doesn't — so rather than fake a percentage,
 * a wait long enough to feel broken says why it is long.
 */
export default function LogoLoader({ label = 'Loading Prime Developers', hint = null }) {
  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 bg-void px-6"
      role="status"
      aria-live="polite"
    >
      <div className="prime-logo-loader" aria-hidden="true">
        <img className="prime-logo-loader__ghost" src={primeLogomark} alt="" />
        <div className="prime-logo-loader__reveal">
          <img src={primeLogomark} alt="" />
        </div>
        <span className="prime-logo-loader__line" />
      </div>

      {/* Rendered rather than swapped in, so the layout does not jump when the
          wait turns out to be a long one. */}
      <p
        className={`max-w-[30ch] text-center font-body text-[13px] leading-relaxed text-bone-3 transition-opacity duration-700 ${
          hint ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {hint ?? ' '}
      </p>

      <span className="sr-only">{hint ? `${label}. ${hint}` : label}</span>
    </div>
  )
}