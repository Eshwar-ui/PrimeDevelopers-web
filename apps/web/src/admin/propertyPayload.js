// What the property editor sends to PATCH /admin/properties/:id.
//
// Built from a list of the fields the API accepts — UpdatePropertyDto in
// apps/api/src/modules/properties/dto/property.dto.ts — rather than from the
// record minus a few known extras. The API rejects any field it does not
// declare (`forbidNonWhitelisted`), so subtracting was one new column away
// from breaking every save: the record grew `trackerProjectId` and
// `trackerSyncedAt` with the tracker sync, the editor sent them back, and
// every save from this page answered 400.
//
// The API's tests import this file and run its output through the real DTO,
// so a field added on one side and not the other fails there, not in front
// of an editor. Plain JS with no imports, for that reason.

/** Every column the editor may write. Anything else on the record stays server-owned. */
export const PROPERTY_FIELDS = [
  'name',
  'slug',
  'address',
  'category',
  'buildings',
  'sold',
  'available',
  'image',
  'gallery',
  'detail',
  'sortOrder',
  'published',
]

/**
 * The PATCH body for a property form: the whitelisted fields, cleaned the way
 * the form needs (empty spec slots and gallery rows dropped), plus the
 * `updatedAt` the edit started from, which the API checks under a row lock.
 */
export function propertyPayload(form, { expectedUpdatedAt } = {}) {
  const payload = {}
  for (const key of PROPERTY_FIELDS) {
    if (form[key] !== undefined) payload[key] = form[key]
  }
  if (payload.detail) {
    const specs = Array.isArray(payload.detail.specs) ? payload.detail.specs : []
    payload.detail = { ...payload.detail, specs: specs.map((v) => String(v ?? '').trim()).filter(Boolean) }
  }
  payload.gallery = (payload.gallery ?? []).filter(Boolean)
  if (expectedUpdatedAt) payload.expectedUpdatedAt = expectedUpdatedAt
  return payload
}
