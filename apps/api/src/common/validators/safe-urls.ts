import { BadRequestException } from '@nestjs/common';

/**
 * Link-like fields in the CMS's free-form JSON (property `detail`, content
 * sections) are free text, so nothing stopped a `javascript:` or `data:` URL
 * from being saved and later handed to an <a href> or window.open on the public
 * site (1 Nov security audit, L1). This checks every string under a key that
 * names a link or a media source, wherever it sits in the object.
 *
 * Allowed, because the live data uses each of them today:
 *   https://…     a link or file elsewhere
 *   /path         a file or page on this site (not //host, which is another site)
 *   ''            not set
 *   #             a placeholder the pages render as "no link" (footer socials)
 *   mailto: tel:  contact links
 * Everything else, http: included, is refused with the field's path.
 */
const LINK_KEY = /^(url|href|src|link|flyer|poster|image|thumbnail|logo|cover|.*(Url|Href|Link|Src|Image|Poster|Logo))$/i;
const SAFE = /^(https:\/\/\S+|\/(?!\/)\S*|#|mailto:\S+|tel:[+\d\s().-]+)$/i;

export function isSafeUrl(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === '' || SAFE.test(trimmed);
}

/** The paths of every link-like field under `value` whose URL is not allowed. */
export function unsafeUrls(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((item, i) => unsafeUrls(item, `${path}[${i}]`));
  if (!value || typeof value !== 'object') return [];
  const found: string[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const at = path ? `${path}.${key}` : key;
    if (typeof child === 'string') {
      if (LINK_KEY.test(key) && !isSafeUrl(child)) found.push(at);
    } else if (Array.isArray(child) && LINK_KEY.test(key.replace(/s$/, ''))) {
      // A list of plain URLs under a plural link key (`gallery` is handled by the caller).
      child.forEach((item, i) => {
        if (typeof item === 'string' && !isSafeUrl(item)) found.push(`${at}[${i}]`);
        else found.push(...unsafeUrls(item, `${at}[${i}]`));
      });
    } else {
      found.push(...unsafeUrls(child, at));
    }
  }
  return found;
}

/** Throws a 400 naming each refused field, so the admin can see what to fix. */
export function assertSafeUrls(value: unknown, where: string): void {
  const bad = unsafeUrls(value);
  if (bad.length === 0) return;
  throw new BadRequestException(
    `These links in ${where} must start with https://, /, mailto: or tel: (or be empty): ${bad.slice(0, 10).join(', ')}${bad.length > 10 ? ` and ${bad.length - 10} more` : ''}`,
  );
}
