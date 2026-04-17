import path from 'node:path'
import { defineConfig } from 'prisma/config'

// Prisma 7 does not auto-load .env when prisma.config.ts is present.
// In production (Render), env vars are injected by the platform — no .env file exists.
try {
  process.loadEnvFile(path.join(process.cwd(), '.env'))
} catch {
  // .env not present (production/CI environment) — rely on platform-injected env vars
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  // DIRECT_URL bypasses the connection pooler — required for migrate/db push
  datasource: {
    url: process.env.DIRECT_URL,
  },
})
