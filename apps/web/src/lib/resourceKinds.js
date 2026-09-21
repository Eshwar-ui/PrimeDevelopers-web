// What kind of thing a property resource link actually is.
//
// The labels are free text an admin typed — Centro Plaza alone carries
// "Crexi", "Loopnet", "Flyer", "Floor Plans" and "Location" — and they were
// never one kind of thing. Rendered as one grid of identical buttons they
// read as nine grey rectangles, so the most useful link and the least useful
// link cost the same to find. The label is the only signal on offer, with the
// URL as a fallback for the file types, so the kind is matched off that.
//
// Order is the logic: the first pattern to match wins, so the specific
// ("floor plan") has to be listed before the general ("plan", "flyer"), and
// the fallback has to be last. A link that matches nothing is still a link —
// it gets the neutral kind rather than being hidden or guessed at.

import { ArrowSquareOut, Blueprint, DownloadSimple, FilePdf, MapPin, Storefront } from '@phosphor-icons/react'

/**
 * `action` is the glyph on the right of the tile and it describes what the
 * click *does*, not what the file is: a PDF host is still somewhere you land,
 * so only the things that actually hand you a file get the download arrow.
 */
const KINDS = [
  {
    id: 'listing',
    caption: 'Listing',
    Icon: Storefront,
    action: ArrowSquareOut,
    test: /\b(crexi|loopnet|costar|zillow|realtor|listing|marketplace)\b/i,
  },
  {
    id: 'plan',
    caption: 'Floor plan',
    Icon: Blueprint,
    action: ArrowSquareOut,
    test: /\b(floor\s*plans?|site\s*plans?|blueprints?|layouts?)\b/i,
  },
  {
    id: 'map',
    caption: 'Map',
    Icon: MapPin,
    action: ArrowSquareOut,
    test: /\b(location|map|directions|address|google\s*maps)\b/i,
  },
  {
    id: 'document',
    caption: 'Document',
    Icon: FilePdf,
    action: DownloadSimple,
    test: /\b(flyer|brochure|pdf|sheet|deck|package|om|offering)\b/i,
  },
]

const FALLBACK = { id: 'link', caption: 'Link', Icon: ArrowSquareOut, action: ArrowSquareOut }

/** A `.pdf` URL is a document whatever the label calls it. */
const PDF_URL = /\.pdf(\?|#|$)/i

export const resourceKind = (label, url = '') => {
  const text = String(label ?? '')
  const match = KINDS.find((kind) => kind.test.test(text))
  if (match) return match
  if (PDF_URL.test(String(url))) return KINDS.find((kind) => kind.id === 'document')
  return FALLBACK
}
