// Renders admin-edited heading text, honoring two lightweight conventions so
// plain text can still carry the design's visual flourishes:
//  - `*word*` wraps the match in the site's italic accent-color treatment
//  - a literal newline becomes a line break (for two-line headings)
// `text-accent`, not `text-accent-soft`. accent-soft is a fixed pigment, the
// same value in both themes, which is why the emphasis failed on light grounds:
// it measured 2.7:1 on surface-alt, under even the 3:1 large-text bar.
// `--color-accent` is the role token — CG Blue on light, lifting to exactly the
// accent-soft value on dark — so dark mode renders identically to the pigment
// and only the light theme deepens.
export function renderEmphasis(text, accentClass = 'italic text-accent') {
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
