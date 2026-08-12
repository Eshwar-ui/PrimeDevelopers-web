// Turns a pasted watch/share link into something an <iframe> will accept, and
// tells hosted embeds apart from files we serve ourselves. Admins paste
// whatever the address bar gave them, so both shapes have to be handled.

const YOUTUBE_ID = /(?:youtu\.be\/|v=|embed\/)([\w-]{11})/
const VIMEO_ID = /vimeo\.com\/(?:video\/)?(\d+)/
// Reels, feed posts and IGTV all embed the same way; the path segment is kept
// so the embed URL matches the kind of post that was pasted.
const INSTAGRAM_ID = /instagram\.com\/(reel|reels|p|tv)\/([\w-]+)/

// True when the URL belongs to a video host that must be framed rather than
// played through the native <video> element.
export function isEmbedUrl(url) {
  if (!url) return false
  return YOUTUBE_ID.test(url) || VIMEO_ID.test(url) || INSTAGRAM_ID.test(url)
}

// Instagram gets its own question because its embed is portrait and comes
// wrapped in post chrome, so it can't fill a landscape frame the way the
// other hosts do — the layout has to letterbox it instead of stretching it.
export function isInstagramUrl(url) {
  return Boolean(url) && INSTAGRAM_ID.test(url)
}

export function youtubeEmbedUrl(url) {
  const match = url.match(YOUTUBE_ID)
  return match ? `https://www.youtube.com/embed/${match[1]}` : url
}

// Embed URL with autoplay on — used when the poster's play button is what
// mounted the frame, so the click the user already made is the gesture.
export function autoplayEmbedUrl(url) {
  const yt = url.match(YOUTUBE_ID)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0`
  const vimeo = url.match(VIMEO_ID)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1`
  // Instagram has no autoplay parameter — the frame lands showing the post's
  // own play button, so the visitor taps twice. Nothing to be done about it
  // short of hosting the file ourselves.
  const ig = url.match(INSTAGRAM_ID)
  if (ig) return `https://www.instagram.com/${ig[1]}/${ig[2]}/embed/`
  return url
}
