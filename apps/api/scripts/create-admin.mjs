// Create (or reset the password of) a website CMS admin user.
//
// This exists because the admin account has always been made by hand. When
// Supabase project knghxhtfkbswzhphhigy was deleted on 2 Sep 2026 and the CMS
// was rebuilt on a fresh project, the account was the one piece that could not
// be reconstructed from the repo — everything else came from migrations and
// the seed scripts.
//
// Connects with Prisma, not supabase-js, on purpose: migrations 8 and 10 leave
// `website_admin_users` with RLS enabled, no policies and no grants to anon or
// authenticated, precisely so nothing reachable from a browser can read it.
// The API reaches it as the table owner, and so does this.
//
// The password is read from stdin rather than argv so it does not land in the
// shell history or a process listing.
//
// Lives under apps/api rather than the repo's own scripts/ because pnpm's
// strict node_modules only resolves @prisma/client and bcrypt for the package
// that depends on them, and Node resolves from the script's directory rather
// than the working one.
//
// Run with:
//   cd apps/api && node --env-file=.env scripts/create-admin.mjs admin@gmail.com
//
// Re-running with an existing email resets that user's password and leaves
// everything else alone.

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import readline from 'node:readline'

const email = process.argv[2]
if (!email || !email.includes('@')) {
  console.error('Usage: node --env-file=.env scripts/create-admin.mjs <email>')
  process.exit(1)
}

// 12 rounds. bcrypt.compare reads the cost from the hash itself, so this can be
// raised later without invalidating existing rows.
const ROUNDS = 12

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr })
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a) }))
}

const prisma = new PrismaClient()

try {
  const password = (await prompt(`Password for ${email}: `)).trim()

  // The admin CMS is the only thing standing between a stranger and the live
  // site's content, and the last account's password was flagged as weak in
  // docs/deployment-plan.md. Refuse the obviously bad ones here rather than
  // leaving it to whoever types fastest.
  if (password.length < 12) {
    console.error('Too short — use at least 12 characters.')
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, ROUNDS)

  const user = await prisma.websiteAdminUser.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash, name: 'Prime Admin' },
  })

  // Any session issued against the old password should stop working.
  const { count } = await prisma.websiteAdminRefreshToken.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  console.error(`Admin ready: ${user.email}${count ? ` (revoked ${count} existing session${count === 1 ? '' : 's'})` : ''}`)
} finally {
  await prisma.$disconnect()
}
