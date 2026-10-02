// src/single-assigned-agent/single-assigned-agent.ownership.spec.ts
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

/**
 * SingleAssignedAgent is written by SingleAssignedAgentService and nothing
 * else. Teams and memberships must not fan out into it, and no other module
 * may reach for the Prisma delegate's mutating methods directly. Reads stay
 * open (access checks, dashboards, listings).
 *
 * This test walks src/ and fails on any mutating call outside the owning
 * service, so the rule cannot regress quietly.
 */
const SRC_ROOT = join(__dirname, '..');
const OWNER = join('single-assigned-agent', 'single-assigned-agent.service.ts');

const MUTATION =
  /singleAssignedAgent\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'generated' || entry === 'node_modules') continue;
      walk(full, out);
    } else if (full.endsWith('.ts') && !full.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('SingleAssignedAgent table ownership', () => {
  it('is only mutated from SingleAssignedAgentService', () => {
    const offenders: string[] = [];

    for (const file of walk(SRC_ROOT)) {
      const rel = relative(SRC_ROOT, file).split(sep).join('/');
      if (rel === OWNER.split(sep).join('/')) continue;

      const source = readFileSync(file, 'utf8');
      const lines = source.split('\n');
      lines.forEach((line, i) => {
        if (MUTATION.test(line)) offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
        MUTATION.lastIndex = 0;
      });
    }

    expect(offenders).toEqual([]);
  });
});
