Brand marks for the marketplaces a property is listed on.

Drop a file named after the marketplace and nothing else needs to change —
lib/marketplaceLogos.js picks it up at build time and the Resources section
on a property page starts using it in place of the generic Phosphor glyph.

  crexi.svg
  loopnet.svg
  costar.svg
  zillow.svg

Accepted: .svg (preferred), .png, .webp.

Square-ish marks work best: the chip is 48px and the art is fitted inside it
with object-contain, on a fixed white ground in both themes, because these are
supplied logos drawn for white and tinting them is not ours to do.

A file that is not here is not an error. The glob only maps what exists, so a
missing mark can never ship as a broken image — the typed glyph stands in.
