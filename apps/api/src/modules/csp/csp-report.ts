/**
 * Browsers send Content-Security-Policy violations in one of two shapes:
 *
 * - `report-uri` (what the site's header uses, and what every browser supports):
 *   a single object under "csp-report", with kebab-case keys.
 * - the Reporting API (`report-to`): an array of reports, each `{ type, url, body }`
 *   with camelCase keys, of which only `csp-violation` is ours.
 *
 * Both arrive as text (see main.ts) and are reduced to the fields that say what was
 * blocked and where. Everything is clipped, and URLs lose their query string — a
 * page's query can carry anything, and the path is enough to find the page.
 */
export interface CspViolation {
  directive: string;
  blocked: string;
  document: string;
  source?: string;
  line?: number;
  sample?: string;
}

const MAX_LENGTH = 200;
// One page load can trip many directives at once; a body claiming more than this
// is noise or abuse, and the first few say everything the rest would.
const MAX_REPORTS = 10;

const clip = (value: unknown) => (typeof value === 'string' ? value.slice(0, MAX_LENGTH) : undefined);
const withoutQuery = (value: unknown) => clip(value)?.split(/[?#]/)[0];

type Raw = Record<string, unknown>;

function fromReportUri(r: Raw): CspViolation {
  return {
    directive: clip(r['effective-directive'] ?? r['violated-directive']) ?? '',
    blocked: withoutQuery(r['blocked-uri']) ?? '',
    document: withoutQuery(r['document-uri']) ?? '',
    source: withoutQuery(r['source-file']),
    line: typeof r['line-number'] === 'number' ? r['line-number'] : undefined,
    sample: clip(r['script-sample']),
  };
}

function fromReportingApi(r: Raw): CspViolation {
  return {
    directive: clip(r.effectiveDirective) ?? '',
    blocked: withoutQuery(r.blockedURL) ?? '',
    document: withoutQuery(r.documentURL) ?? '',
    source: withoutQuery(r.sourceFile),
    line: typeof r.lineNumber === 'number' ? r.lineNumber : undefined,
    sample: clip(r.sample),
  };
}

const isObject = (value: unknown): value is Raw => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function parseCspReports(body: unknown): CspViolation[] {
  let parsed: unknown = body;
  if (typeof body === 'string') {
    try {
      parsed = JSON.parse(body);
    } catch {
      return [];
    }
  }

  if (Array.isArray(parsed)) {
    return parsed
      .filter((r): r is Raw => isObject(r) && r.type === 'csp-violation' && isObject(r.body))
      .slice(0, MAX_REPORTS)
      .map((r) => fromReportingApi(r.body as Raw));
  }
  if (isObject(parsed) && isObject(parsed['csp-report'])) return [fromReportUri(parsed['csp-report'])];
  return [];
}
