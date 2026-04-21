import path from 'node:path'
import { defineConfig, env } from 'prisma/config'

// Prisma 7 does not auto-load .env when prisma.config.ts is present.
// In production (Render), env vars are injected by the platform — no .env file exists.
try {
  process.loadEnvFile(path.join(process.cwd(), '.env'))
} catch {
  // .env not present (production/CI environment) — rely on platform-injected env vars
}

// DIRECT_URL is only required for migrate/push operations, not for `prisma generate`.
const needsDirectUrl = process.argv.some((arg) =>
  ['migrate', 'db', 'push', 'pull'].includes(arg),
)
if (needsDirectUrl && !process.env.DIRECT_URL) {
  throw new Error(
    'DIRECT_URL is not set. Prisma CLI (db push / migrate) requires a non-pooled connection. ' +
      'Set DIRECT_URL to the Supabase session-mode pooler (port 5432) or direct host.',
  )
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  // DIRECT_URL bypasses the transaction-mode pooler for DDL (migrate/push).
  // For generate and runtime, DATABASE_URL (pooled) is sufficient.
  datasource: {
    url: needsDirectUrl ? env('DIRECT_URL') : env('DATABASE_URL'),
  },
})