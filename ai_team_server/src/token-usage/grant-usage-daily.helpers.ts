// src/token-usage/grant-usage-daily.helpers.ts
import { Logger } from '@nestjs/common';
import {
  AgentName,
  GrantUsageSource,
  Prisma,
} from 'src/generated/prisma/client';

type Db = {
  grantTokenUsageDaily: Prisma.TransactionClient['grantTokenUsageDaily'];
};

const logger = new Logger('GrantUsageDaily');

/** Midnight UTC of a day, the shape the @db.Date column stores. */
const startOfUtcDay = (value: Date) =>
  new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );

/**
 * Adds one chat's spend on a team or single-agent grant to today's row of
 * GrantTokenUsageDaily, which feeds the usage charts and nothing else.
 *
 * The deltas are signed (a refund comes in negative) and are what the grant
 * actually moved by. Best-effort by design: the grant row is the source of
 * truth, so a failed chart write is logged and never fails the chat.
 */
export async function recordGrantUsageDay(
  db: Db,
  entry: {
    oauthId: string;
    agentName: AgentName;
    source: GrantUsageSource;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  },
): Promise<void> {
  const { oauthId, agentName, source, inputTokens, outputTokens, totalTokens } =
    entry;
  if (!inputTokens && !outputTokens && !totalTokens) return;

  const date = startOfUtcDay(new Date());
  try {
    await db.grantTokenUsageDaily.upsert({
      where: {
        oauthId_agentName_source_date: { oauthId, agentName, source, date },
      },
      create: {
        oauthId,
        agentName,
        source,
        date,
        inputTokens,
        outputTokens,
        totalTokens,
      },
      update: {
        inputTokens: { increment: inputTokens },
        outputTokens: { increment: outputTokens },
        totalTokens: { increment: totalTokens },
      },
    });
  } catch (error) {
    logger.warn(
      `Could not record ${source} usage for ${agentName} (${oauthId}): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
