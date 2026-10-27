import { HONEYPOT_FIELD } from '../lib/spamSignals'

/**
 * A form field for bots only.
 *
 * Off screen, out of the tab order, and hidden from assistive technology
 * (`aria-hidden`, and `inert` so nothing inside can take focus), so a person
 * never fills it; a script that fills every input it finds does. Its name and
 * label match no autofill profile, so the browser doesn't fill it for them
 * either. The API then files the submission as filtered rather than as a lead
 * (SpamSignalsDto in apps/api).
 *
 * Read from the form's FormData by spamSignals(). Goes inside a positioned
 * ancestor; the field is moved off screen rather than hidden with
 * `display: none`, which the more careful bots know to skip.
 */
export default function Honeypot() {
  return (
    <div
      aria-hidden="true"
      inert
      className="pointer-events-none absolute -left-[9999px] top-0 h-px w-px overflow-hidden opacity-0"
    >
      <label>
        Leave this empty
        <input name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  )
}
