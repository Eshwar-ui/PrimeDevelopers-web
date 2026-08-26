export function youtubeEmbedUrl(url) {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    let id = ''
    if (parsed.hostname === 'youtu.be') id = parsed.pathname.slice(1).split('/')[0]
    if (parsed.hostname.includes('youtube.com')) {
      id = parsed.searchParams.get('v') || parsed.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1] || ''
    }
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : ''
  } catch {
    return ''
  }
}

export function relatedSlugs(value = '') {
  return value.split(',').map((slug) => slug.trim()).filter(Boolean)
}
