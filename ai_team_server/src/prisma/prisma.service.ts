import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor() {
        // Uses DATABASE_URL (pooler) for runtime queries
        const pool = new Pool({ connectionString: process.env.DATABASE_URL })
        const adapter = new PrismaPg(pool)
        super({ adapter })
    }

    async onModuleInit() {
        await this.$connect();
        console.log('Database Connection established');
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}
