import {
  Injectable,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AgentName } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

const MODEL = 'claude-sonnet-4-6';

export interface ClaudeCallOptions {
  oauthId: string;
  agentName: AgentName;
  messages: Anthropic.MessageParam[];
  system?: string;
  maxTokens?: number;
}

@Injectable()
export class TokenUsageService {
  private readonly anthropic: Anthropic;

  constructor(private readonly prisma: PrismaService) {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  private async calculateUserQuota(oauthId: string, agentName: AgentName) {
    const user = await this.prisma.user.findUnique({
      where: { oauthId },
      include: {
        agents: { where: { isActive: true } },
        groups: { where: { isActive: true }, include: { group: { include: { items: true } } } },
        memberships: { where: { isActive: true }, include: { template: true } }
      }
    });
    
    if (!user) return { limit: 100000, cycleStart: new Date(new Date().setDate(1)), userId: null };
    
    let totalLimit = 0;
    let earliestStart = new Date();
    let hasAccess = false;

    // Check direct
    const directAssigned = user.agents.find(a => a.agentName === agentName);
    if (directAssigned) {
      hasAccess = true;
      totalLimit += directAssigned.monthlyTokenLimit || 0;
      if (directAssigned.startsAt < earliestStart) earliestStart = directAssigned.startsAt;
    }

    // Check groups
    for (const g of user.groups) {
      if (g.group.items.some(i => i.agentName === agentName)) {
        hasAccess = true;
        totalLimit += g.monthlyTokenLimit || 0;
        if (g.startsAt < earliestStart) earliestStart = g.startsAt;
      }
    }

    // Check memberships
    for (const m of user.memberships) {
      let grants = m.template.includedAgents.includes(agentName);
      if (!grants && m.template.includedGroupIds.length > 0) {
        const groupItems = await this.prisma.agentGroupItem.findMany({
          where: { groupId: { in: m.template.includedGroupIds as string[] }, agentName }
        });
        if (groupItems.length > 0) grants = true;
      }
      
      if (grants) {
        hasAccess = true;
        totalLimit += m.template.monthlyTokenLimit;
        if (m.startsAt < earliestStart) earliestStart = m.startsAt;
      }
    }

    // fallback to legacy limit if 0
    if (totalLimit === 0) {
      const legacy = await this.prisma.userAgentTokenUsage.findUnique({ where: { oauthId_agentName: { oauthId, agentName} }});
      if (legacy) totalLimit = legacy.tokenLimit;
      else totalLimit = 100000;
    }

    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const now = new Date();
    let daysSince = Math.floor((now.getTime() - earliestStart.getTime()) / MS_PER_DAY);
    if (daysSince < 0) daysSince = 0;
    const cycles = Math.floor(daysSince / 30);
    const cycleStart = new Date(earliestStart.getTime() + cycles * 30 * MS_PER_DAY);

    return { limit: totalLimit, cycleStart, userId: user.id };
  }

  private async checkThresholds(userId: string, oauthId: string, used: number, limit: number) {
    if (!userId || limit <= 0) return;
    const percent = used / limit;
    
    let threshold = 0;
    if (percent >= 1.0) threshold = 100;
    else if (percent >= 0.9) threshold = 90;
    else if (percent >= 0.8) threshold = 80;
    else if (percent >= 0.5) threshold = 50;

    if (threshold > 0) {
      const typeStr = `TOKEN_THRESHOLD_${threshold}`;
      // Check if we recently alerted this threshold to avoid spamming
      const existing = await this.prisma.userAlert.findFirst({
         where: { userId, type: typeStr, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
      });
      if (!existing) {
        await this.prisma.userAlert.create({
          data: {
            userId,
            type: typeStr,
            message: `You have reached ${threshold}% of your monthly token limit.`
          }
        });
      }
    }
  }

  async callClaude(opts: ClaudeCallOptions): Promise<Anthropic.Message> {
    const { oauthId, agentName, messages, system, maxTokens = 8096 } = opts;

    const { limit, cycleStart, userId } = await this.calculateUserQuota(oauthId, agentName);

    // Get current cycle usage
    const cycleUsages = await this.prisma.dailyTokenUsage.findMany({
      where: { oauthId, agentName, date: { gte: cycleStart } }
    });
    const totalCycleUsed = cycleUsages.reduce((sum, d) => sum + d.totalTokens, 0) + 1000; // add a buffer for estimation

    if (totalCycleUsed >= limit) {
      await this.prisma.tokenLimitStopLog.create({
        data: { oauthId, agentName, reason: 'monthly limit reached', attemptedTokens: totalCycleUsed }
      });
      throw new ForbiddenException(`Token limit of ${limit} reached for agent ${agentName}`);
    }

    let response: Anthropic.Message;
    try {
      response = await this.anthropic.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
        messages,
      });
    } catch (err) {
      throw new InternalServerErrorException(`Claude API error: ${err?.message}`);
    }

    const input = response.usage?.input_tokens ?? 0;
    const output = response.usage?.output_tokens ?? 0;
    const totalNew = input + output;

    // Track daily usage
    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date(`${todayStr}T00:00:00Z`);

    await this.prisma.dailyTokenUsage.upsert({
      where: { oauthId_agentName_date: { oauthId, agentName, date: today } },
      create: { oauthId, agentName, date: today, inputTokens: input, outputTokens: output, totalTokens: totalNew },
      update: {
        inputTokens: { increment: input },
        outputTokens: { increment: output },
        totalTokens: { increment: totalNew }
      }
    });

    // Update legacy usage tracker just to keep it in sync for total overall
    await this.prisma.userAgentTokenUsage.upsert({
      where: { oauthId_agentName: { oauthId, agentName } },
      create: { oauthId, agentName, inputTokens: input, outputTokens: output, totalTokens: totalNew, tokenLimit: limit },
      update: {
        inputTokens: { increment: input },
        outputTokens: { increment: output },
        totalTokens: { increment: totalNew },
        tokenLimit: limit
      },
    });

    // Check thresholds
    const exactCycleUsed = totalCycleUsed - 1000 + totalNew;
    if (userId) {
      await this.checkThresholds(userId, oauthId, exactCycleUsed, limit);
    }

    return response;
  }

  async setTokenLimit(oauthId: string, agentName: AgentName, tokenLimit: number) {
    return this.prisma.userAgentTokenUsage.upsert({
      where: { oauthId_agentName: { oauthId, agentName } },
      create: { oauthId, agentName, tokenLimit },
      update: { tokenLimit },
    });
  }

  async getUserUsage(oauthId: string) {
    return this.prisma.userAgentTokenUsage.findMany({
      where: { oauthId },
      orderBy: { totalTokens: 'desc' },
    });
  }

  async getAgentUsage(oauthId: string, agentName: AgentName) {
    return this.prisma.userAgentTokenUsage.findUnique({
      where: { oauthId_agentName: { oauthId, agentName } },
    });
  }

  async getAllUsage() {
    return this.prisma.userAgentTokenUsage.findMany({
      include: { user: { select: { email: true, username: true } } },
      orderBy: { totalTokens: 'desc' },
    });
  }
}
