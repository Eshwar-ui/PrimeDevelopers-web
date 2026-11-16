// CMS link fields accept only safe schemes (1 Nov security audit L1).
//
//   pnpm --filter @prime-developers/api test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeUrls, isSafeUrl, unsafeUrls } from '../src/common/validators/safe-urls';

test('allows what the live CMS holds today', () => {
  for (const ok of ['https://theprimedeveloper.info/4bmL7lL?r=lp', '/media/images/a.jpg', '', '#', 'mailto:sales@theprimedeveloper.com', 'tel:+1 (512) 555-0100']) {
    assert.equal(isSafeUrl(ok), true, ok);
  }
});

test('refuses script, data, plain http and protocol-relative links', () => {
  for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,<b>x</b>', 'http://example.com', '//evil.test/x', 'vbscript:x', 'evil.test']) {
    assert.equal(isSafeUrl(bad), false, bad);
  }
});

test('finds bad links anywhere in a property detail blob, by path', () => {
  const detail = {
    overview: { flyer: 'javascript:alert(1)', body: 'javascript: in prose is fine' },
    resourceLinks: [{ url: 'https://ok.test/a', label: 'ok' }, { url: 'data:text/html,x', label: 'bad' }],
    socials: [{ url: 'mailto:a@b.c' }],
    buildings: [{ units: [{ floorPlanImage: '/media/x.png', videoUrl: 'http://insecure.test/v.mp4' }] }],
    logos: ['https://ok.test/l.png', 'javascript:x'],
  };
  assert.deepEqual(unsafeUrls(detail), [
    'overview.flyer',
    'resourceLinks[1].url',
    'buildings[0].units[0].videoUrl',
    'logos[1]',
  ]);
});

test('assertSafeUrls throws a 400 that names the fields', () => {
  assert.doesNotThrow(() => assertSafeUrls({ footer: { socials: [{ href: '#' }] } }, 'footer'));
  assert.throws(
    () => assertSafeUrls({ hero: { ctaHref: 'javascript:alert(1)' } }, 'the hero section'),
    (err: any) => err.getStatus() === 400 && /hero\.ctaHref/.test(err.message),
  );
});
