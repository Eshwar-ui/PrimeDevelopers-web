// The two bot tells the public lead forms send with every submission (see
// SpamSignalsDto in apps/api). A submission that trips either is kept but
// filtered out of the inbox, so a person caught by mistake isn't lost.

/**
 * The honeypot's input name in the DOM. Deliberately meaningless: autofill
 * matches on names like "website", "url", "company" or "fax", and a field it
 * fills for a real visitor would file their enquiry as spam. Sent to the API
 * as `honeypot`.
 */
export const HONEYPOT_FIELD = 'pd-hp-7f3'

// Past this, an open tab is an open tab. The API accepts any length; the
// number is capped only so it stays an ordinary integer.
const MAX_FILL_MS = 24 * 60 * 60 * 1000

/** `{ honeypot, fillMs }` for a lead POST, from the form's data and its clock. */
export function spamSignals(formData, elapsedMs) {
  const honeypot = String(formData.get(HONEYPOT_FIELD) ?? '')
  return {
    ...(honeypot && { honeypot }),
    ...(typeof elapsedMs === 'number' && { fillMs: Math.min(Math.max(0, Math.round(elapsedMs)), MAX_FILL_MS) }),
  }
}
