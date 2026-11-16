import dns from 'node:dns';
import https from 'node:https';
import type { ClientRequest, IncomingMessage, RequestOptions } from 'node:http';
import { BlockList, isIP } from 'node:net';
import { Readable } from 'node:stream';

/**
 * Fetches a brochure PDF from a URL that came from the CMS, for attaching to an
 * email whose recipient the visitor chooses.
 *
 * That makes it a server-side request to an admin-supplied address with the
 * response mailed outward, so a bare fetch() is an SSRF and exfiltration
 * channel: the API runs on EC2, and http://169.254.169.254/ is one CMS edit
 * away (audit 1 Nov M1, 15 Nov task 2). So:
 *
 *   - https only, on every hop;
 *   - the address is checked when the socket connects, in the DNS lookup the
 *     connection actually uses, so a name cannot resolve public for a check
 *     and private for the request (DNS rebinding). IP literals skip lookup in
 *     Node, so they are checked before connecting;
 *   - redirects are followed by hand, at most three, each re-checked;
 *   - only a 200 whose type is application/pdf and whose bytes start %PDF- is
 *     returned. Every brochure link in the CMS on 15 Nov was a web page, and a
 *     web page used to be attached as if it were the brochure;
 *   - one deadline covers every hop and the body, and the body is capped.
 *
 * It never throws. Any refusal comes back as a reason, so the caller still
 * sends the visitor their email, just without the attachment.
 */

export type PdfResult = { ok: true; body: Buffer; filename: string } | { ok: false; reason: string };

type Lookup = NonNullable<RequestOptions['lookup']>;

export interface FetchPdfOptions {
  maxBytes: number;
  timeoutMs: number;
  maxRedirects?: number;
  /** Injected in tests; https.request in production. */
  request?: (options: RequestOptions) => ClientRequest;
  /** Injected in tests; dns.lookup in production. */
  lookup?: Lookup;
  /** Injected in tests; isBlockedAddress in production. */
  isBlocked?: (ip: string) => boolean;
}

// Everything that is not the public internet. Ranges from the IANA special-
// purpose registries; anything not parseable as an address is refused too.
const BLOCKED = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, including the EC2 metadata service
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, and 255.255.255.255
] as const) {
  BLOCKED.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
  ['2001:db8::', 32], // documentation
] as const) {
  BLOCKED.addSubnet(network, prefix, 'ipv6');
}

/** IPv4 carried inside IPv6: ::ffff:a.b.c.d (mapped) or 64:ff9b::/96 (NAT64). */
function embeddedIpv4(ip: string): string | null {
  const lower = ip.toLowerCase();
  const dotted = /^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (dotted) return dotted[1];
  const hex = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (!hex) return null;
  const [hi, lo] = [parseInt(hex[1], 16), parseInt(hex[2], 16)];
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

/** True for any address the brochure fetch must not connect to. */
export function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return BLOCKED.check(ip, 'ipv4');
  if (family === 6) {
    const v4 = embeddedIpv4(ip);
    return v4 ? BLOCKED.check(v4, 'ipv4') : BLOCKED.check(ip, 'ipv6');
  }
  return true;
}

/** Moved here from leads.service so one implementation caps every download. */
export async function readCapped(res: Response, max: number): Promise<Buffer | null> {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) return null;
  if (!res.body) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

class Refused extends Error {}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

/** A lookup that resolves every address and refuses the lot if any is blocked. */
function guardedLookup(base: Lookup, isBlocked: (ip: string) => boolean): Lookup {
  return ((hostname: string, options: any, callback: any) => {
    base(hostname, { ...options, all: true }, (err: NodeJS.ErrnoException | null, addresses: any) => {
      if (err) return callback(err);
      const list: { address: string; family: number }[] = Array.isArray(addresses) ? addresses : [{ address: addresses, family: 4 }];
      const bad = list.find((a) => isBlocked(a.address));
      if (bad || !list.length) {
        return callback(new Refused(`${hostname} resolves to a private or blocked address (${bad?.address ?? 'none'})`));
      }
      return options?.all ? callback(null, list) : callback(null, list[0].address, list[0].family);
    });
  }) as Lookup;
}

function filenameOf(url: URL): string {
  let name = url.pathname.split('/').pop() || 'brochure';
  try {
    name = decodeURIComponent(name);
  } catch {
    // A malformed escape keeps its raw form rather than failing the email.
  }
  name = name.replace(/[\r\n"\\/]/g, '').trim() || 'brochure';
  return /\.pdf$/i.test(name) ? name : `${name}.pdf`;
}

export async function fetchPublicPdf(rawUrl: string, options: FetchPdfOptions): Promise<PdfResult> {
  const request = options.request ?? https.request;
  const isBlocked = options.isBlocked ?? isBlockedAddress;
  const lookup = guardedLookup(options.lookup ?? (dns.lookup as unknown as Lookup), isBlocked);
  const maxRedirects = options.maxRedirects ?? 3;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  const timedOut = () => controller.signal.aborted;

  try {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return { ok: false, reason: 'not a valid URL' };
    }

    for (let hop = 0; ; hop++) {
      if (url.protocol !== 'https:') return { ok: false, reason: `only https links are fetched (got ${url.protocol})` };
      const host = url.hostname.replace(/^\[|\]$/g, '');
      if (isIP(host) && isBlocked(host)) return { ok: false, reason: `${host} is a private or blocked address` };

      const res = await send(request, url, host, lookup, controller.signal);
      const status = res.statusCode ?? 0;

      if (REDIRECTS.has(status)) {
        res.resume();
        const location = res.headers.location;
        if (!location) return { ok: false, reason: `redirect ${status} without a location` };
        if (hop >= maxRedirects) return { ok: false, reason: `more than ${maxRedirects} redirects` };
        url = new URL(location, url);
        continue;
      }
      if (status !== 200) {
        res.resume();
        return { ok: false, reason: `the link answered ${status}` };
      }

      const type = String(res.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
      if (type !== 'application/pdf') {
        res.resume();
        return { ok: false, reason: `the link is ${type || 'an unknown type'}, not a PDF` };
      }

      const length = res.headers['content-length'];
      const body = await readCapped(
        new Response(Readable.toWeb(res) as ReadableStream, length ? { headers: { 'content-length': length } } : undefined),
        options.maxBytes,
      );
      if (!body) return { ok: false, reason: `the PDF is larger than ${options.maxBytes} bytes` };
      if (body.subarray(0, 5).toString('latin1') !== '%PDF-') return { ok: false, reason: 'the file is labelled PDF but is not a PDF' };

      return { ok: true, body, filename: filenameOf(url) };
    }
  } catch (err) {
    if (timedOut()) return { ok: false, reason: `timed out after ${options.timeoutMs} ms` };
    if (err instanceof Refused) return { ok: false, reason: err.message };
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

function send(
  request: NonNullable<FetchPdfOptions['request']>,
  url: URL,
  host: string,
  lookup: Lookup,
  signal: AbortSignal,
): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = request({
      host,
      servername: isIP(host) ? undefined : host,
      port: url.port || 443,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      // A fresh connection every time. Node's global agent keeps sockets alive,
      // and a reused socket never runs `lookup` — the address check would then
      // depend on what connected earlier. Brochure fetches are rare enough that
      // pooling buys nothing.
      agent: false,
      lookup,
      signal,
      headers: { accept: 'application/pdf', 'user-agent': 'PrimeDevelopers-Brochure/1.0' },
    } as RequestOptions);
    req.once('response', resolve);
    req.once('error', (err) => reject((err as any)?.cause instanceof Refused ? (err as any).cause : err));
    req.end();
  });
}
