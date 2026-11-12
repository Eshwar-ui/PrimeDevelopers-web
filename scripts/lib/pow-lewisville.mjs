// Shared by both POW Lewisville content scripts.
export const MAP_QUERY = '2601 E State Hwy 121, Lewisville, TX'

// The nearby-areas section is the same on Phase I and Phase II.
export function neighborhoods() {
  return {
    heading: 'Close to Castle Hills, Grandscape and the SH 121 corridor',
    // TODO: /lewisville doesn't exist yet — restore the link on "office warehouse for sale in Lewisville".
    intro: 'POW Lewisville is surrounded by new homes and regional shopping on both sides of SH 121. Looking for office warehouse for sale in Lewisville close to your customers? This is it.',
    mapQuery: MAP_QUERY,
    // TODO: confirm drive times before adding minutes; confirm the Castle Hills home count.
    items: [
      { name: 'Castle Hills, Lewisville', note: 'Large master-planned community with thousands of homes right next to the site.' },
      { name: 'Grandscape and Nebraska Furniture Mart, The Colony', note: 'Regional shopping, dining and entertainment destination along SH 121.' },
      { name: 'Walmart Supercenter, Lewisville', note: 'Everyday shopping for the neighborhoods around the site.' },
      { name: 'The Colony High School', note: 'Local high school serving families in The Colony and Castle Hills.' },
    ],
  }
}
