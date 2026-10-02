// Local-only timing harness — not for commit.
import 'dotenv/config';
import * as pg from 'pg';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UserService } from '../src/user/services/user.service';
import { AdminDashboardService } from '../src/admin/admin-dashboard.service';

let n = 0;
const orig = (pg.Client.prototype as any).query;
(pg.Client.prototype as any).query = function (...args: any[]) { n += 1; return orig.apply(this, args); };

async function time(label: string, fn: () => Promise<any>) {
  for (let i = 0; i < 2; i++) {
    n = 0; const t = Date.now();
    const r = await fn();
    console.log(`${label}: ${Date.now() - t}ms, sql=${n}, bytes=${JSON.stringify(r).length}`);
  }
}
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const users = app.get(UserService);
  const dash = app.get(AdminDashboardService);
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  await time('list', () => users.findAllUsers({ page: 1, limit: 10, usageFrom: from, usageTo: now, sortBy: 'monthly', sortDir: 'desc' } as any));
  const first = await users.findAllUsers({ page: 1, limit: 10, sortBy: 'createdAt', sortDir: 'desc' } as any);
  await time('detail', () => dash.getUserDetails(first.data[0].id, 30, from, now));
  await app.close();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
