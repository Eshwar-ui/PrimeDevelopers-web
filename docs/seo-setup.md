# SEO setup: robots, sitemap and per-page heads

The site is a client-rendered SPA. Google runs the JavaScript and reads the head React
writes, but social scrapers (WhatsApp, LinkedIn, Facebook, X, Slack) don't, so before
this setup every shared link showed the generic `index.html` title and no image.

The setup has three parts. None of them can break a route.

## 1. `robots.txt` and `sitemap.xml`

`scripts/seo-assets.mjs` writes both into `dist/` during `scripts/deploy-web-aws.sh`.

- On the CloudFront host (`dtw8rs0oq8bpp.cloudfront.net`), `robots.txt` disallows
  everything, because that copy must not compete with the real domain in search.
- On `https://theprimedeveloper.com`, `robots.txt` is open (it disallows only `/admin`
  and `/api/`), and `sitemap.xml` lists the static pages plus every published property
  and post.

Both files have an extension, so the CloudFront function passes them through untouched.

## 2. Per-route HTML files

`scripts/prerender.mjs` copies the built `index.html` once per route and swaps the head
for that route's head: title, description, canonical, `og:*`, `twitter:*` and JSON-LD.
It writes `dist/<path>/index.html` and lists those paths in
`dist/.prerendered-routes.json`. The list is never uploaded.

- The body stays the empty SPA shell, and the inline scripts are left byte for byte,
  so their CSP hashes still match.
- The root `index.html` gets the home page's head. Every route without a file of its
  own falls back to it, including a property published after the last deploy.

## 3. CloudFront serves those files only for listed paths

`website_spa` in `prime-tracker-main/infra/terraform/website.tf` runs on every request
to the site, not on `/api/*`:

| Request | Served |
|---|---|
| A path with an extension (`/robots.txt`, `/assets/x.js`) | That file, as before |
| An app path that is a key in the store `prime-tracker-website-routes` | `<path>/index.html` |
| Any other app path, or the store lookup fails | `/index.html`, as before |

A trailing slash is ignored. The store holds keys only (the value is unused).

The function never asks S3 for a file the store doesn't name. With OAC and no
`ListBucket` permission, a missing object answers 403 rather than falling back. That
is why there is no distribution-wide 403→`index.html` error response: it once turned
API 404s into 200s.

### Keeping the store in step: `scripts/route-store.mjs`

`deploy-web-aws.sh` runs the store sync in two steps:

1. `prune`, before any upload, removes keys for pages this build no longer has. Their
   files are still in the bucket at this point.
2. `add`, after the HTML upload, adds keys for the new files.

At no point does a key name a file that isn't there. Use `--dry-run` to see what a
step would do.

## Checks after a deploy

```bash
UA='facebookexternalhit/1.1'
SITE=https://dtw8rs0oq8bpp.cloudfront.net
curl -s -A "$UA" $SITE/properties/centro-plaza | grep -o '<title>[^<]*'
curl -s -A "$UA" $SITE/no-such-page | grep -o '<title>[^<]*'
curl -s $SITE/robots.txt
curl -s -o /dev/null -w '%{http_code}\n' $SITE/sitemap.xml
aws cloudfront-keyvaluestore list-keys --profile prime-client \
  --kvs-arn "$(aws cloudfront list-key-value-stores --profile prime-client \
    --query "KeyValueStoreList.Items[?Name=='prime-tracker-website-routes'].ARN" --output text)"
```

- The first command should show the property's own title.
- The second should show the home page's title.

## Rolling back

- **One page wrong:** delete its key with `aws cloudfront-keyvaluestore delete-key`. The
  page falls back to the shell at once.
- **All pages:** empty the store. Routing is then exactly what it was before this setup.
