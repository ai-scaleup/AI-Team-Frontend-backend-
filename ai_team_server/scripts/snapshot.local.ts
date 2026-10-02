// Local-only equivalence harness — not for commit. Writes every list/detail
// response for a grid of parameters to a JSON file for before/after diffing.
import 'dotenv/config';
import * as fs from 'fs';
import * as pg from 'pg';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UserService } from '../src/user/services/user.service';
import { AdminDashboardService } from '../src/admin/admin-dashboard.service';

let n = 0;
const orig = (pg.Client.prototype as any).query;
(pg.Client.prototype as any).query = function (...a: any[]) { n += 1; return orig.apply(this, a); };

async function main() {
  const out = process.argv[2];
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const users = app.get(UserService);
  const dash = app.get(AdminDashboardService);
  const now = new Date();
  const day = 86400000;
  const ranges: [string, Date | undefined, Date | undefined][] = [
    ['default', undefined, undefined],
    ['month', new Date(now.getFullYear(), now.getMonth(), 1), now],
    ['today', new Date(new Date(now).setHours(0, 0, 0, 0)), now],
    ['last7', new Date(now.getTime() - 7 * day), now],
    ['lastMonth', new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)],
    ['year', new Date(now.getTime() - 365 * day), now],
    ['reversed', now, new Date(now.getTime() - 20 * day)],
  ];
  const result: Record<string, unknown> = {};
  const stats: Record<string, { ms: number; sql: number }[]> = {};
  const record = async (key: string, kind: string, fn: () => Promise<unknown>) => {
    n = 0; const t = Date.now();
    result[key] = JSON.parse(JSON.stringify(await fn()));
    (stats[kind] ??= []).push({ ms: Date.now() - t, sql: n });
  };
  const all = await users.findAllUsers({ page: 1, limit: 100, sortBy: 'createdAt', sortDir: 'desc' } as any);
  const memberships = Array.from(new Set(all.data.flatMap((u: any) => u.memberships.map((m: any) => m.template?.name)).filter(Boolean)));
  const listCases: any[] = [];
  for (const [rk, usageFrom, usageTo] of ranges)
    for (const sortBy of ['createdAt', 'duration', 'monthly', 'weekly', 'daily'])
      for (const sortDir of ['asc', 'desc'])
        listCases.push({ page: 1, limit: 10, usageFrom, usageTo, sortBy, sortDir, _r: rk });
  for (const status of ['active', 'expiring', 'expired']) listCases.push({ page: 1, limit: 10, status, sortBy: 'monthly', sortDir: 'desc' });
  for (const membership of [...memberships, 'none', 'nope']) listCases.push({ page: 1, limit: 10, membership, sortBy: 'createdAt', sortDir: 'desc' });
  for (const search of ['gmail', 'alex', 'marketing', 'lara', 'zzz']) listCases.push({ page: 1, limit: 10, search, sortBy: 'weekly', sortDir: 'asc' });
  for (const [page, limit] of [[1, 1], [2, 1], [3, 2], [99, 5]]) listCases.push({ page, limit, sortBy: 'monthly', sortDir: 'desc' });
  for (const c of listCases) {
    const { _r, ...q } = c;
    await record(`list ${JSON.stringify({ ...q, usageFrom: _r })}`, 'list', () => users.findAllUsers(q));
  }
  for (const u of all.data as any[])
    for (const [rk, from, to] of ranges)
      await record(`detail ${u.email} ${rk}`, 'detail', () => dash.getUserDetails(u.id, 30, from, to));
  fs.writeFileSync(out, JSON.stringify(result, null, 1));
  for (const [k, v] of Object.entries(stats)) {
    const avg = (f: 'ms' | 'sql') => Math.round(v.reduce((s, x) => s + x[f], 0) / v.length);
    console.log(`${k}: ${v.length} calls, avg ${avg('ms')}ms, avg sql ${avg('sql')}, max sql ${Math.max(...v.map((x) => x.sql))}`);
  }
  console.log(`users=${all.data.length} memberships=${memberships.join(',')}`);
  await app.close(); process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
