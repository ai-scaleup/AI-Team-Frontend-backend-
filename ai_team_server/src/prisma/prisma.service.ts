import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Runtime traffic should use Supabase's transaction pooler. Fall back to
    // the direct/session URL only in environments that do not define a pooled
    // DATABASE_URL.
    const connectionString =
      process.env.DATABASE_URL ?? process.env.DIRECT_URL;

    if (!connectionString) {
      throw new Error('DIRECT_URL or DATABASE_URL must be configured');
    }

    const configuredPoolMax = Number(process.env.DB_POOL_MAX ?? 1);
    const poolMax =
      Number.isInteger(configuredPoolMax) && configuredPoolMax > 0
        ? configuredPoolMax
        : 1;

    const adapter = new PrismaPg({
      connectionString,
      // Queue concurrent Prisma work behind one client connection. Supabase's
      // database-side pool for this project is small; allowing node-postgres to
      // open its default ten clients made parallel admin-page requests compete
      // until Supavisor returned ECHECKOUTTIMEOUT.
      max: poolMax,
      idleTimeoutMillis: 10_000,
    });
    super({ adapter });
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('Disconnected');
  }

  async onModuleInit() {
    await this.$connect();
    console.log('Connected');
  }
}
