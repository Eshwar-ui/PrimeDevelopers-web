// Renders admin-edited heading text, honoring two lightweight conventions so
// plain text can still carry the design's visual flourishes:
//  - `*word*` wraps the match in the site's italic accent-color treatment
//  - a literal newline becomes a line break (for two-line headings)
export function renderEmphasis(text, accentClass = 'italic text-accent-soft') {
  if (!text) return null
  const lines = text.split('\n')
  return lines.flatMap((line, li) => {
    const parts = line.split(/\*(.+?)\*/g).map((part, i) =>
      i % 2 === 1 ? (
        <span key={`${li}-${i}`} className={accentClass}>
          {part}
        </span>
      ) : (
        part
      )
    )
    return li < lines.length - 1 ? [...parts, <br key={`br-${li}`} />] : parts
  })
}
