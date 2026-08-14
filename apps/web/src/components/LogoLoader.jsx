import primeLogomark from '../assets/prime-logomark.svg'

export default function LogoLoader({ label = 'Loading Prime Developers' }) {
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center bg-void"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="prime-logo-loader" aria-hidden="true">
        <img className="prime-logo-loader__ghost" src={primeLogomark} alt="" />
        <div className="prime-logo-loader__reveal">
          <img src={primeLogomark} alt="" />
        </div>
        <span className="prime-logo-loader__line" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  )
}