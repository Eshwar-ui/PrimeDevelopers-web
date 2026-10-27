import { Component } from 'react'
import ActionButton from './ActionButton'
import { reportError } from '../lib/reportError'

/**
 * Catches a render error below it and shows `fallback` instead of letting
 * React unmount the whole tree.
 *
 * Without one, a lazy chunk that fails to arrive — a flaky phone connection,
 * or a deploy that replaced the file mid-visit — takes every component with
 * it, and the visitor is left on a blank page with nothing to press.
 *
 * `fallback` is an element, or a function of `{ error, reset }`. `resetKey`
 * clears the error when it changes, so navigating to another route recovers
 * without a reload. `onError` replaces the default reporting, for callers that
 * report with more context of their own.
 */
export default class ErrorBoundary extends Component {
  state = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error) {
    return { error }
  }

  // Cleared during render rather than after it, so the page behind the new
  // key renders straight away instead of the fallback flashing for a frame.
  static getDerivedStateFromProps(props, state) {
    return props.resetKey === state.resetKey ? null : { error: null, resetKey: props.resetKey }
  }

  componentDidCatch(error, info) {
    if (this.props.onError) this.props.onError(error, info)
    else reportError(error, { where: this.props.name ?? 'boundary', componentStack: info?.componentStack })
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const { fallback = null } = this.props
    return typeof fallback === 'function' ? fallback({ error, reset: this.reset }) : fallback
  }
}

/**
 * What a page shows when it fails to render. A reload, because the usual
 * cause is a chunk that did not arrive and a browser will not re-request a
 * module it has already seen fail; the home link for when that does not help.
 */
export function PageError() {
  return (
    <section data-band="light" className="flex min-h-[70dvh] items-center justify-center bg-base px-6 py-28 text-content">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="eyebrow text-content/60">Something went wrong</span>
        <h1 className="font-display text-[clamp(1.9rem,3vw,2.6rem)] font-bold tracking-[-0.03em]">This page didn’t load</h1>
        <p className="font-body text-[15px] leading-relaxed text-content/70">
          It is usually the connection. Reloading the page normally fixes it.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <ActionButton as="button" type="button" onClick={() => window.location.reload()}>
            Reload page
          </ActionButton>
          <ActionButton href="/" tone="ghost">
            Go to the home page
          </ActionButton>
        </div>
      </div>
    </section>
  )
}
