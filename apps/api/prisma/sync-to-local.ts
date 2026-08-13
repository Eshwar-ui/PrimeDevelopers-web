/**
 * Copies production CMS content into a local Supabase stack so the admin can be
 * exercised against realistic data instead of smoke-test fixtures.
 *
 * Usage — start the local stack first (`supabase start` from the repo root),
 * then run from apps/api:
 *
 *   SOURCE_DATABASE_URL='<production DATABASE_URL>' pnpm exec ts-node prisma/sync-to-local.ts
 *
 * TARGET_DATABASE_URL defaults to the local Supabase Postgres. The target is
 * wiped and rewritten, never merged, so a run always lands in a known state.
 *
 * Three things are deliberately NOT copied:
 *
 *   - `website_leads` and their attributions. These are real names, emails,
 *     phone numbers and messages from members of the public. Copying them onto
 *     a laptop widens who can see that data and where it lives, for no testing
 *     benefit the CMS content doesn't already provide. `INCLUDE_LEADS=true`
 *     overrides this, but prefer generating fake enquiries through the contact
 *     form instead.
 *   - `website_admin_users`. Password hashes are credentials. Provision a local
 *     login with seed-admin.ts against the local database instead.
 *   - Storage objects. The buckets are public and the copied rows keep their
 *     production URLs, so images and models load from production without
 *     needing a byte copied. Newly uploaded files land in the local bucket.
 */
import { Prisma, PrismaClient } from '@prisma/client';

const LOCAL_SUPABASE_DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

/**
 * The target is truncated. If the two URLs were ever transposed this script
 * would erase the live site's content, so the target has to prove it is local
 * before anything is deleted. A flag cannot override this — the guard is the
 * whole reason the script is safe to run casually.
 */
function assertLocal(url: string) {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('TARGET_DATABASE_URL is not a valid URL.');
  }
  const local = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
  if (!local.includes(host)) {
    throw new Error(
      `Refusing to run: TARGET_DATABASE_URL points at "${host}", which is not local. ` +
        'This script deletes every row in the target before copying. ' +
        `Expected one of: ${local.join(', ')}.`,
    );
  }
}

async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  const targetUrl = process.env.TARGET_DATABASE_URL ?? LOCAL_SUPABASE_DB;

  if (!sourceUrl) {
    throw new Error(
      'SOURCE_DATABASE_URL is required — the production connection string, from Render → prime-developers-api → Environment.',
    );
  }
  assertLocal(targetUrl);

  const includeLeads = process.env.INCLUDE_LEADS === 'true';

  const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
  const target = new PrismaClient({ datasources: { db: { url: targetUrl } } });

  try {
    const [sourceDb] = await source.$queryRawUnsafe<Array<{ db: string }>>(
      'select current_database() as db',
    );
    const [targetDb] = await target.$queryRawUnsafe<Array<{ db: string }>>(
      'select current_database() as db',
    );
    console.log(`source: ${sourceDb.db}`);
    console.log(`target: ${targetDb.db} (local)\n`);

    const [content, properties, news] = await Promise.all([
      source.content.findMany(),
      source.property.findMany(),
      source.news.findMany(),
    ]);

    // Children before parents on the way out, parents before children on the
    // way in — the attribution table has FKs to both leads and properties.
    await target.websiteLeadUnitAttribution.deleteMany();
    await target.websiteLead.deleteMany();
    await target.content.deleteMany();
    await target.property.deleteMany();
    await target.news.deleteMany();

    // Prisma reads jsonb as `JsonValue` and writes it as `InputJsonValue`, and
    // the two differ only over how JSON null is represented. These columns are
    // non-nullable with object/array defaults, so a value read from one of them
    // is always valid input for the other.
    const asJson = (value: Prisma.JsonValue) => value as Prisma.InputJsonValue;

    await target.content.createMany({
      data: content.map((row) => ({ ...row, data: asJson(row.data) })),
    });
    await target.property.createMany({
      data: properties.map((row) => ({
        ...row,
        gallery: asJson(row.gallery),
        detail: asJson(row.detail),
      })),
    });
    await target.news.createMany({ data: news });

    console.log(`content    ${content.length}`);
    console.log(`properties ${properties.length}`);
    console.log(`news       ${news.length}`);

    if (includeLeads) {
      const leads = await source.websiteLead.findMany();
      const attributions = await source.websiteLeadUnitAttribution.findMany();
      await target.websiteLead.createMany({ data: leads });
      await target.websiteLeadUnitAttribution.createMany({ data: attributions });
      console.log(`leads      ${leads.length}  <-- CONTAINS REAL PERSONAL DATA`);
      console.log(`           delete this local database when you are done with it.`);
    } else {
      console.log('leads      skipped (personal data — set INCLUDE_LEADS=true to override)');
    }

    console.log('\nNext: provision a local admin against the same target —');
    console.log(
      `  DATABASE_URL='${targetUrl}' ADMIN_EMAIL='admin@gmail.com' ADMIN_PASSWORD='...' pnpm exec ts-node prisma/seed-admin.ts`,
    );
  } finally {
    await Promise.all([source.$disconnect(), target.$disconnect()]);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
