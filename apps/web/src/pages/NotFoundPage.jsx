import { ArrowRight } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'

// "404" set in building blocks: each digit is a 4 x 7 grid of cells, and each
// cell is a block with two bays of four storeys of windows.
//
// This used to be a react-three-fiber scene — three, fiber and drei, a city
// environment map and contact shadows — for a page whose only job is to say
// the address is wrong. It was decorative: nothing in it led anywhere. The
// same drawing as SVG costs nothing to load and cannot fail on a phone
// without WebGL, which the 3D version did by rendering an empty dark page.
const GLYPHS = {
  4: ['1001', '1001', '1001', '1111', '0001', '0001', '0001'],
  0: ['1111', '1001', '1001', '1001', '1001', '1001', '1111'],
}
const DIGITS = ['4', '0', '4']

const CELL = 40
// Centre-to-centre spacing of the digits, in cells — the old scene's 4.3
// units at its 0.78 scale.
const PITCH = 5.5
const WIDTH = (PITCH * (DIGITS.length - 1) + 4) * CELL
const HEIGHT = 7 * CELL

// Window placement within one cell, as fractions of it: two bays, four floors.
const WINDOW = { w: 0.27, h: 0.17 }
const BAYS = [0.29, 0.71]
const FLOORS = [0.15, 0.39, 0.61, 0.85]

function Digit({ glyph, x, seed }) {
  const cells = []
  GLYPHS[glyph].forEach((row, rowIndex) => {
    ;[...row].forEach((value, columnIndex) => {
      if (value === '1') cells.push([x + columnIndex * CELL, rowIndex * CELL])
    })
  })

  return (
    // `group`, so hovering a digit lights the whole number the way the old
    // scene's pointer did — the one bit of play worth keeping.
    <g className="group">
      {cells.map(([cx, cy], index) => (
        <g key={index} transform={`translate(${cx} ${cy})`}>
          <rect
            x="1"
            y="1"
            width={CELL - 2}
            height={CELL - 2}
            rx="2"
            // Lighter than the old material's base colour, which only read
            // under the scene's key light; flat, it vanished into the ground.
            className="fill-[#163c4e] stroke-[#0a1c25] transition-colors duration-300 group-hover:fill-[#1d5068]"
          />
          {FLOORS.map((fy, floor) =>
            BAYS.map((fx, bay) => {
              const lit = (floor * 3 + bay + index + seed) % 4 !== 0
              return (
                <rect
                  key={`${floor}-${bay}`}
                  x={(fx - WINDOW.w / 2) * CELL}
                  y={(fy - WINDOW.h / 2) * CELL}
                  width={WINDOW.w * CELL}
                  height={WINDOW.h * CELL}
                  filter={lit ? 'url(#nf-glow)' : undefined}
                  className={
                    lit
                      ? 'fill-[#8bdcff] transition-colors duration-300 group-hover:fill-[#d4f2ff]'
                      : 'fill-[#0c222c]'
                  }
                />
              )
            }),
          )}
        </g>
      ))}
    </g>
  )
}

export default function NotFoundPage() {
  return (
    <section data-band="dark" className="relative min-h-[100svh] overflow-hidden bg-[#071116] text-bone">
      <h1 className="sr-only">404 — page not found</h1>
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_62%_42%,transparent_0,transparent_22%,rgba(7,17,22,.34)_58%,#071116_100%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10 opacity-[0.055] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:64px_64px]" />
      {/* The old scene's CG Blue point light, off to the left. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_46%,rgba(0,115,164,.3),transparent_42%)]" />

      <div aria-hidden className="absolute inset-0 flex flex-col items-center justify-center px-6 pt-20">
        {/* A slight turn, so the number still reads as blocks standing in a
            space rather than as type on the page. */}
        <div className="[transform:perspective(1400px)_rotateX(6deg)_rotateY(-8deg)]">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-[min(86vw,44rem)] overflow-visible">
            <defs>
              <filter id="nf-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {DIGITS.map((glyph, i) => (
              <Digit key={i} glyph={glyph} x={i * PITCH * CELL} seed={i * 5} />
            ))}
          </svg>
        </div>
        {/* The contact shadow the blocks stood on. */}
        <div className="mt-6 h-5 w-[min(70vw,34rem)] rounded-[50%] bg-black/70 blur-xl" />
      </div>

      <Link
        to="/"
        className="absolute bottom-8 right-8 z-20 inline-flex items-center gap-3 font-body text-[11px] uppercase tracking-[0.16em] text-bone/45 transition-colors duration-200 hover:text-bone"
      >
        Back to the home page
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </section>
  )
}
