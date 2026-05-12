import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const [
    tokenUsage,
    dailyUsage,
    stopLogs,
    agentAssignments,
    groupAssignments,
    membershipAssignments,
    tokenAlerts,
    membershipTemplates,
  ] = await prisma.$transaction([
    prisma.userAgentTokenUsage.updateMany({
      data: {
        totalUsedInputTokens: 0,
        totalUsedOutputTokens: 0,
        totalUsedTokens: 0,
        totalTokensLeft: 0,
        totalTokenLimit: 0,
      },
    }),
    prisma.dailyTokenUsage.updateMany({
      data: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
    }),
    prisma.tokenLimitStopLog.deleteMany(),
    prisma.assignedAgent.updateMany({
      data: {
        monthlyTokenLimit: 0,
        threshold50Notified: false,
        threshold80Notified: false,
        threshold90Notified: false,
        threshold100Notified: false,
      },
    }),
    prisma.assignedGroup.updateMany({
      data: {
        monthlyTokenLimit: 0,
        threshold50Notified: false,
        threshold80Notified: false,
        threshold90Notified: false,
        threshold100Notified: false,
      },
    }),
    prisma.assignedMembership.updateMany({
      data: {
        threshold50Notified: false,
        threshold80Notified: false,
        threshold90Notified: false,
        threshold100Notified: false,
      },
    }),
    prisma.userAlert.updateMany({
      where: { type: { startsWith: 'TOKEN_THRESHOLD_' } },
      data: { read: true },
    }),
    prisma.membershipTemplate.updateMany({
      data: { monthlyTokenLimit: 0 },
    }),
  ]);

  console.log(
    JSON.stringify(
      {
        tokenUsageRowsReset: tokenUsage.count,
        dailyUsageRowsReset: dailyUsage.count,
        stopLogsDeleted: stopLogs.count,
        agentAssignmentsReset: agentAssignments.count,
        groupAssignmentsReset: groupAssignments.count,
        membershipAssignmentsReset: membershipAssignments.count,
        tokenAlertsDismissed: tokenAlerts.count,
        membershipTemplatesReset: membershipTemplates.count,
      },
      null,
      2,
    ),
  );
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
