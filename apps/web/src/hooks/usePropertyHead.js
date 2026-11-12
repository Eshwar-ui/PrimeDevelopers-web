import { useHead } from './useHead'
import { SITE_ORIGIN } from '../lib/site'
import { faqSchema, propertySchema } from '../lib/structuredData'
import { propertyHead } from '../lib/seo'
import { useProperties } from '../context/ContentContext'
import { phaseTrail } from '../lib/phases'

/**
 * Title, description, canonical, Open Graph / X cards, geo tags and JSON-LD
 * for a property page.
 *
 * The tags themselves come from `propertyHead` in lib/seo, which the
 * prerenderer reads too; this adds the JSON-LD, which only a browser-side
 * crawler will ever run far enough to see, and hands the lot to useHead.
 *
 * It used to write all of it directly, in a copy of the same twenty lines
 * that /faq carried — the two had already drifted (only one set `og:locale`),
 * which is why there is now one implementation.
 *
 * A property is not in lib/seo's route table: what this page should say is a
 * property of the record, not of the route, so there is nothing useful to say
 * until the content fetch lands. Until then `undefined` leaves the head alone.
 */
export function usePropertyHead(property) {
  const spec = propertyHead(property)
  const phase = phaseTrail(useProperties(), property)

  useHead(
    spec
      ? {
          ...spec,
          jsonLd: [
            propertySchema({
              property,
              origin: SITE_ORIGIN,
              url: `${SITE_ORIGIN}${spec.path}`,
              title: spec.title,
              description: spec.description,
              phase,
            }),
            faqSchema(property.detail?.faqs),
          ].filter(Boolean),
        }
      : undefined,
  )
}
