/**
 * Creates or updates a CMS admin account.
 *
 * There is deliberately no signup endpoint — this is a single-tenant CMS with a
 * handful of staff accounts, and an open registration route would be a
 * liability with no corresponding benefit. Accounts are provisioned here.
 *
 * Usage (password is read from the environment, never a CLI argument, so it
 * doesn't end up in shell history or the process list):
 *
 *   cd apps/api
 *   ADMIN_EMAIL=admin@primedevelopers.com ADMIN_PASSWORD='...' pnpm exec ts-node prisma/seed-admin.ts
 *
 * Re-running with the same email resets that account's password.
 *
 * Adding `ADMIN_EXCLUSIVE=true` *replaces* the admin list rather than adding to
 * it: every other account is deleted, leaving exactly one login. It is opt-in
 * because the default — provisioning a colleague without disturbing anyone
 * else — is the common case, and silently deleting coworkers' accounts on a
 * routine seed would be the wrong default by a wide margin.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? null;

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are both required.');
  }
  // Matches LoginDto's floor. These were inconsistent — the seed refused
  // passwords the login endpoint would happily accept, which just meant
  // provisioning failed for accounts that would have worked fine.
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
  }
  if (email.split('@')[0] && password.toLowerCase().includes(email.split('@')[0])) {
    console.warn(
      `WARNING: this password contains the email's local part ("${email.split('@')[0]}"), which makes it guessable from the login address alone. Consider changing it.`,
    );
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.websiteAdminUser.upsert({
      where: { email },
      create: { email, passwordHash, name },
      update: { passwordHash, name },
    });

    // Any outstanding sessions are killed on a password change — otherwise
    // resetting a compromised password would leave the intruder logged in.
    const { count } = await prisma.websiteAdminRefreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    console.log(`Admin ready: ${user.email}`);
    if (count > 0) console.log(`Revoked ${count} existing session(s).`);

    if (process.env.ADMIN_EXCLUSIVE === 'true') {
      // Named before deleting, so the output is a record of what was removed —
      // these rows are unrecoverable afterwards and the operator should be able
      // to see, from the log alone, exactly which logins stopped working.
      const others = await prisma.websiteAdminUser.findMany({
        where: { id: { not: user.id } },
        select: { email: true },
      });

      if (others.length === 0) {
        console.log('ADMIN_EXCLUSIVE: no other accounts existed.');
      } else {
        // Their refresh tokens go with them: the relation is onDelete: Cascade,
        // so no revocation pass is needed here.
        await prisma.websiteAdminUser.deleteMany({ where: { id: { not: user.id } } });
        console.log(`ADMIN_EXCLUSIVE: removed ${others.length} other account(s):`);
        for (const o of others) console.log(`  - ${o.email}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
