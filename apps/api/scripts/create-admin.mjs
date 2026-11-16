// Create (or reset the password of) a website CMS admin user.
//
// Connects with Prisma as the table owner. Against production use
// scripts/aws/05-add-admin.sh instead, which never puts the password on a
// command line; this is for the local Docker database (pnpm db:up).
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
