/**
 * A form field for bots only.
 *
 * Off screen, out of the tab order, hidden from screen readers and from
 * autofill, so a person never fills it; a script that fills every input it
 * finds does. The API then drops the submission while answering as though it
 * landed (SpamSignalsDto in apps/api), so the bot has nothing to learn from.
 *
 * Read by name — `website` — from the form's FormData. Goes inside a
 * positioned ancestor; the field is moved off screen rather than hidden with
 * `display: none`, which the more careful bots know to skip.
 */
export default function Honeypot() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute -left-[9999px] top-0 h-px w-px overflow-hidden opacity-0">
      <label>
        Website
        <input name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  )
}
