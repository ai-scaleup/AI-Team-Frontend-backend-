import path from 'node:path'
import { defineConfig } from 'prisma/config'

// Prisma 7 does not auto-load .env when prisma.config.ts is present
process.loadEnvFile(path.join(process.cwd(), '.env'))

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  // DIRECT_URL bypasses the connection pooler — required for migrate/db push
  datasource: {
    url: process.env.DIRECT_URL,
  },
})
