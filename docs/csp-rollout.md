# CSP rollout: from report-only to enforced

The site's Content-Security-Policy lives in `prime-tracker-main/infra/terraform/website.tf`
(`website_csp`). It has been report-only since the move to AWS: browsers block nothing,
and each violation is logged as a `[CSP]` line in `/prime-tracker/app/website-api`.

## Order

1. **Web deploy** from this repo. This build drops Firebase Analytics, and its deploy
   script refuses to upload a page whose inline-script hash the live header doesn't
   list.
2. **Tracker branch `fix/website-prerender-and-csp`, apply.** It adds the route store
   and drops the analytics hosts. The CSP is still report-only.
3. **Review a week of reports** (below). The week must include admin use: editing a
   property, uploading an image and a `.glb`, the 3D tagger, a property page with a 3D
   model, the 404 page's 3D scene, and a page with a YouTube embed.
4. **Fill in the table below.** Add every legitimate source to `website_csp`, apply,
   and wait 48 hours with no new legitimate violations.
5. **Tracker branch `fix/website-enforce-csp`, apply.** This renames the header to
   `Content-Security-Policy`.
6. **Check in a browser with the console open:**
   - home;
   - a property with a 3D model;
   - the 404 page;
   - a YouTube embed;
   - admin login, property edit and upload.

   Then read 24 hours of `[CSP]` lines.

**Rollback:** rename the header back to `Content-Security-Policy-Report-Only` and
apply. It takes effect within minutes.

## Review

```bash
aws sso login --profile prime-client
node scripts/csp-report-summary.mjs --days 7
```

The script prints the table below, pre-filled except for the Decision column. Its
**Kind** column is a first guess:

| Kind | What it means | What to do |
|---|---|---|
| extension | A browser extension injected it | Ignore |
| inline | An inline script or style | Compare its hash with `node scripts/csp-hashes.mjs apps/web/dist/index.html` |
| site | Our own origin was blocked | It's a bug |
| external | A third-party host | Add it if the site really needs it; otherwise find what loads it |

Reports from before the analytics removal deploy will show Google and Firebase hosts.
Those need no change.

### Results

_Not yet run: it needs the `prime-client` SSO session._

| Count | Kind | Directive | Blocked | Example page | Decision |
|---:|---|---|---|---|---|
