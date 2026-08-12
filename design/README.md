# Design references

Exported Figma frames, used as the source of truth when building pages.

These exist because the Figma MCP connector is rate-limited on a View seat, and
reconstructing measurements by panning and screenshotting the canvas is not
accurate enough — it was the cause of a round of near-miss implementations on
the properties and property-detail pages.

## Exporting

In Figma, select the frame → **Export** panel (bottom of the right sidebar) →
**PNG**, scale **2x** → Export. If the Export panel isn't available on your seat,
a full-resolution screenshot of the frame at 100% zoom works too — the important
part is that it's one image of the whole frame, not a crop.

## Naming

One file per frame, named for the route it describes:

| File | Figma frame | Route |
|---|---|---|
| `home.png` | *(first frame)* | `/` |
| `properties.png` | `Properties grid` — node `251-57` | `/properties` |
| `property-detail.png` | `property page` — node `306-59` | `/properties/:slug` |

Add more as pages are designed — `about.png`, `contact.png`, `news.png`.

If a frame has states the static export can't show (a hover, an open accordion,
an active tab), export those separately as `property-detail--units-open.png` and
so on.

## Why 2x

The frames are 1440 wide. At 2x the export is 2880px, so a 1px hairline and a
16px label are both unambiguous. At 1x, sub-pixel detail and small type get
resampled and I end up estimating again.
