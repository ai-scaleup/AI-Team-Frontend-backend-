import path from 'node:path'
import { defineConfig, env } from 'prisma/config'

// Prisma 7 does not auto-load .env when prisma.config.ts is present.
// In production (Render), env vars are injected by the platform — no .env file exists.
try {
  process.loadEnvFile(path.join(process.cwd(), '.env'))
} catch {
  // .env not present (production/CI environment) — rely on platform-injected env vars
}

// Fail fast in CLI workflows if DIRECT_URL is missing.
// Runtime app uses DATABASE_URL via the driver adapter — this only matters for prisma CLI.
if (!process.env.DIRECT_URL) {
  throw new Error(
    'DIRECT_URL is not set. Prisma CLI (db push / migrate) requires a non-pooled connection. ' +
      'Set DIRECT_URL to the Supabase session-mode pooler (port 5432) or direct host.',
  )
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  // DIRECT_URL bypasses the transaction-mode pooler (port 6543, pgbouncer=true)
  // which doesn't support DDL operations like CREATE/ALTER TABLE.
  datasource: {
    url: env('DIRECT_URL'),
  },
})