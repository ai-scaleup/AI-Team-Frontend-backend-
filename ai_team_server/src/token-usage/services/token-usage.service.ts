import {
  Injectable,
  InternalServerErrorException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AgentName } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

const MODEL = 'claude-sonnet-4-6';

const getAnthropicApiKey = () =>
  process.env.ANTHROPIC_API_KEY ||
  process.env.CLAUDE_API_KEY ||
  process.env.anthropic_api_key ||
  process.env.claude_api_key;

export interface ClaudeCallOptions {
  oauthId: string;
  agentName: AgentName;
  messages: Anthropic.MessageParam[];
  system?: string;
  maxTokens?: number;
}

export interface CountTextTokensResult {
  model: string;
  totalUsedInputTokens: number;
  totalUsedTokens: number;
}

export interface SetTokenUsageInput {
  totalUsedInputTokens: number;
  totalUsedOutputTokens: number;
}

export interface SetDailyTokenUsageInput {
  inputTokens: number;
  outputTokens: number;
}

@Injectable()
export class TokenUsageService {
  private readonly anthropic: Anthropic;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = getAnthropicApiKey();

    if (!apiKey) {
      throw new Error(
        'Anthropic API key is not configured. Set ANTHROPIC_API_KEY or CLAUDE_API_KEY in ai_team_server/.env.',
      );
    }

    this.anthropic = new Anthropic({ apiKey });
  }

  private async resolveEmailToOauthId(email: string): Promise<string> {
    const normalizedEmail = email?.trim();

    if (!normalizedEmail) {
      throw new BadRequestException('email is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { oauthId: true },
    });

    if (!user) {
      throw new NotFoundException(
        `User with email "${normalizedEmail}" not found`,
      );
    }

    return user.oauthId;
  }

  private parseDateParam(date: string): Date {
    const normalizedDate = date?.trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      throw new BadRequestException('date must be in YYYY-MM-DD format');
    }

    const parsedDate = new Date(`${normalizedDate}T00:00:00Z`);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== normalizedDate
    ) {
      throw new BadRequestException('date must be a valid calendar date');
    }

    return parsedDate;
  }

  private async calculateUserQuota(oauthId: string, agentName: AgentName) {
    const user = await this.prisma.user.findUnique({
      where: { oauthId },
      include: {
        agents: { where: { isActive: true } },
        groups: {
          where: { isActive: true },
          include: { group: { include: { items: true } } },
        },
        memberships: {
          where: { isActive: true },
          include: {
            template: {
              include: {
                // A membership can carry whole teams, not just loose agents,
                // so its allowance has to cover the agents on those teams too.
                includedGroups: {
                  where: { isActive: true },
                  include: { group: { include: { items: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!user)
      return {
        limit: 100000,
        cycleStart: new Date(new Date().setDate(1)),
        userId: null,
      };

    let totalLimit = 0;
    let earliestStart = new Date();
    let hasAccess = false;

    // Check direct
    const directAssigned = user.agents.find((a) => a.agentName === agentName);
    if (directAssigned) {
      hasAccess = true;
      totalLimit += directAssigned.monthlyTokenLimit || 0;
      if (directAssigned.startsAt < earliestStart)
        earliestStart = directAssigned.startsAt;
    }

    // Check groups
    for (const g of user.groups) {
      if (g.group.items.some((i) => i.agentName === agentName)) {
        hasAccess = true;
        totalLimit += g.monthlyTokenLimit || 0;
        if (g.startsAt < earliestStart) earliestStart = g.startsAt;
      }
    }

    // Check memberships — an agent counts when the template lists it directly
    // or when it sits on one of the teams the template bundles. The membership
    // is still counted once either way, so bundling a team the user already
    // holds does not hand out its allowance twice.
    for (const m of user.memberships) {
      const coveredDirectly = m.template.includedAgents.includes(agentName);
      const coveredByTeam = m.template.includedGroups.some((link) =>
        link.group.items.some((i) => i.agentName === agentName),
      );

      if (coveredDirectly || coveredByTeam) {
        hasAccess = true;
        totalLimit += m.monthlyTokenLimit ?? m.template.monthlyTokenLimit;
        if (m.startsAt < earliestStart) earliestStart = m.startsAt;
      }
    }

    // fallback to legacy limit if 0
    if (totalLimit === 0) {
      const legacy = await this.prisma.userAgentTokenUsage.findUnique({
        where: { oauthId_agentName: { oauthId, agentName } },
      });
      if (legacy) totalLimit = legacy.totalTokensLeft;
      else totalLimit = 100000;
    }

    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const now = new Date();
    let daysSince = Math.floor(
      (now.getTime() - earliestStart.getTime()) / MS_PER_DAY,
    );
    if (daysSince < 0) daysSince = 0;
    const cycles = Math.floor(daysSince / 30);
    const cycleStart = new Date(
      earliestStart.getTime() + cycles * 30 * MS_PER_DAY,
    );

    return { limit: totalLimit, cycleStart, userId: user.id };
  }

  private async checkThresholds(
    userId: string,
    oauthId: string,
    used: number,
    limit: number,
  ) {
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
        where: {
          userId,
          type: typeStr,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
      if (!existing) {
        await this.prisma.userAlert.create({
          data: {
            userId,
            type: typeStr,
            message: `You have reached ${threshold}% of your monthly token limit.`,
          },
        });
      }
    }
  }

  async callClaude(opts: ClaudeCallOptions): Promise<Anthropic.Message> {
    const { oauthId, agentName, messages, system, maxTokens = 8096 } = opts;

    const { limit, cycleStart, userId } = await this.calculateUserQuota(
      oauthId,
      agentName,
    );

    // Get current cycle usage
    const cycleUsages = await this.prisma.dailyTokenUsage.findMany({
      where: { oauthId, agentName, date: { gte: cycleStart } },
    });
    const totalCycleUsed =
      cycleUsages.reduce((sum, d) => sum + d.totalTokens, 0) + 1000; // add a buffer for estimation

    if (totalCycleUsed >= limit) {
      await this.prisma.tokenLimitStopLog.create({
        data: {
          oauthId,
          agentName,
          reason: 'monthly limit reached',
          attemptedTokens: totalCycleUsed,
        },
      });
      throw new ForbiddenException(
        `Token limit of ${limit} reached for agent ${agentName}`,
      );
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
      throw new InternalServerErrorException(
        `Claude API error: ${err?.message}`,
      );
    }

    const input = response.usage?.input_tokens ?? 0;
    const output = response.usage?.output_tokens ?? 0;
    const totalNew = input + output;

    // Track daily usage
    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date(`${todayStr}T00:00:00Z`);

    await this.prisma.dailyTokenUsage.upsert({
      where: { oauthId_agentName_date: { oauthId, agentName, date: today } },
      create: {
        oauthId,
        agentName,
        date: today,
        inputTokens: input,
        outputTokens: output,
        totalTokens: totalNew,
      },
      update: {
        inputTokens: { increment: input },
        outputTokens: { increment: output },
        totalTokens: { increment: totalNew },
      },
    });

    // Update legacy usage tracker just to keep it in sync for total overall
    await this.prisma.userAgentTokenUsage.upsert({
      where: { oauthId_agentName: { oauthId, agentName } },
      create: {
        oauthId,
        agentName,
        totalUsedInputTokens: input,
        totalUsedOutputTokens: output,
        totalUsedTokens: totalNew,
        totalTokensLeft: limit,
        totalTokenLimit: limit,
      },
      update: {
        totalUsedInputTokens: { increment: input },
        totalUsedOutputTokens: { increment: output },
        totalUsedTokens: { increment: totalNew },
        totalTokensLeft: limit,
        totalTokenLimit: limit,
      },
    });

    // Check thresholds
    const exactCycleUsed = totalCycleUsed - 1000 + totalNew;
    if (userId) {
      await this.checkThresholds(userId, oauthId, exactCycleUsed, limit);
    }

    return response;
  }

  async setTokenLimit(
    email: string,
    agentName: AgentName,
    totalTokenLimit: number,
  ) {
    const oauthId = await this.resolveEmailToOauthId(email);

    return this.prisma.userAgentTokenUsage.upsert({
      where: { oauthId_agentName: { oauthId, agentName } },
      create: {
        oauthId,
        agentName,
        totalTokenLimit,
        totalTokensLeft: totalTokenLimit,
      },
      update: { totalTokenLimit, totalTokensLeft: totalTokenLimit },
    });
  }

  async setTokenUsage(
    email: string,
    agentName: AgentName,
    usage: SetTokenUsageInput,
  ) {
    const inputTokens = Number(usage?.totalUsedInputTokens);
    const outputTokens = Number(usage?.totalUsedOutputTokens);
    const totalTokens = inputTokens + outputTokens;

    if (
      !Number.isInteger(inputTokens) ||
      inputTokens < 0 ||
      !Number.isInteger(outputTokens) ||
      outputTokens < 0
    ) {
      throw new BadRequestException(
        'totalUsedInputTokens and totalUsedOutputTokens must be non-negative integers',
      );
    }

    const oauthId = await this.resolveEmailToOauthId(email);

    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date(`${todayStr}T00:00:00Z`);

    const existingUsage = await this.prisma.userAgentTokenUsage.findUnique({
      where: { oauthId_agentName: { oauthId, agentName } },
      select: { totalTokenLimit: true, totalUsedTokens: true },
    });

    const totalTokenLimit = existingUsage?.totalTokenLimit ?? 100000;
    const nextTotalUsedTokens =
      (existingUsage?.totalUsedTokens ?? 0) + totalTokens;
    const totalTokensLeft = Math.max(0, totalTokenLimit - nextTotalUsedTokens);

    const [, tokenUsage] = await this.prisma.$transaction([
      this.prisma.dailyTokenUsage.upsert({
        where: { oauthId_agentName_date: { oauthId, agentName, date: today } },
        create: {
          oauthId,
          agentName,
          date: today,
          inputTokens,
          outputTokens,
          totalTokens,
        },
        update: {
          inputTokens: { increment: inputTokens },
          outputTokens: { increment: outputTokens },
          totalTokens: { increment: totalTokens },
        },
      }),
      this.prisma.userAgentTokenUsage.upsert({
        where: { oauthId_agentName: { oauthId, agentName } },
        create: {
          oauthId,
          agentName,
          totalUsedInputTokens: inputTokens,
          totalUsedOutputTokens: outputTokens,
          totalUsedTokens: totalTokens,
          totalTokenLimit,
          totalTokensLeft,
        },
        update: {
          totalUsedInputTokens: { increment: inputTokens },
          totalUsedOutputTokens: { increment: outputTokens },
          totalUsedTokens: { increment: totalTokens },
          totalTokensLeft,
        },
      }),
    ]);

    return tokenUsage;
  }

  async setDailyTokenUsage(
    email: string,
    agentName: AgentName,
    date: string,
    usage: SetDailyTokenUsageInput,
  ) {
    const inputTokens = Number(usage?.inputTokens);
    const outputTokens = Number(usage?.outputTokens);
    const totalTokens = inputTokens + outputTokens;

    if (
      !Number.isInteger(inputTokens) ||
      inputTokens < 0 ||
      !Number.isInteger(outputTokens) ||
      outputTokens < 0
    ) {
      throw new BadRequestException(
        'inputTokens and outputTokens must be non-negative integers',
      );
    }

    const oauthId = await this.resolveEmailToOauthId(email);
    const usageDate = this.parseDateParam(date);

    const existingUsage = await this.prisma.userAgentTokenUsage.findUnique({
      where: { oauthId_agentName: { oauthId, agentName } },
      select: { totalTokenLimit: true, totalUsedTokens: true },
    });

    const totalTokenLimit = existingUsage?.totalTokenLimit ?? 100000;
    const nextTotalUsedTokens =
      (existingUsage?.totalUsedTokens ?? 0) + totalTokens;
    const totalTokensLeft = Math.max(0, totalTokenLimit - nextTotalUsedTokens);

    const [dailyTokenUsage] = await this.prisma.$transaction([
      this.prisma.dailyTokenUsage.upsert({
        where: {
          oauthId_agentName_date: { oauthId, agentName, date: usageDate },
        },
        create: {
          oauthId,
          agentName,
          date: usageDate,
          inputTokens,
          outputTokens,
          totalTokens,
        },
        update: {
          inputTokens: { increment: inputTokens },
          outputTokens: { increment: outputTokens },
          totalTokens: { increment: totalTokens },
        },
      }),
      this.prisma.userAgentTokenUsage.upsert({
        where: { oauthId_agentName: { oauthId, agentName } },
        create: {
          oauthId,
          agentName,
          totalUsedInputTokens: inputTokens,
          totalUsedOutputTokens: outputTokens,
          totalUsedTokens: totalTokens,
          totalTokenLimit,
          totalTokensLeft,
        },
        update: {
          totalUsedInputTokens: { increment: inputTokens },
          totalUsedOutputTokens: { increment: outputTokens },
          totalUsedTokens: { increment: totalTokens },
          totalTokensLeft,
        },
      }),
    ]);

    return dailyTokenUsage;
  }

  async countTextTokens(text: string): Promise<CountTextTokensResult> {
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new BadRequestException('text must be a non-empty string');
    }

    try {
      const tokenCount = await this.anthropic.messages.countTokens({
        model: MODEL,
        messages: [{ role: 'user', content: text }],
      });

      return {
        model: MODEL,
        totalUsedInputTokens: tokenCount.input_tokens,
        totalUsedTokens: tokenCount.input_tokens,
      };
    } catch (err) {
      throw new InternalServerErrorException(
        `Claude token count error: ${err?.message}`,
      );
    }
  }

  async getUserUsage(email: string) {
    const oauthId = await this.resolveEmailToOauthId(email);

    return this.prisma.userAgentTokenUsage.findMany({
      where: { oauthId },
      orderBy: { totalUsedTokens: 'desc' },
    });
  }

  async getAgentUsage(email: string, agentName: AgentName) {
    const oauthId = await this.resolveEmailToOauthId(email);

    return this.prisma.userAgentTokenUsage.findUnique({
      where: { oauthId_agentName: { oauthId, agentName } },
    });
  }

  async getDailyTokenUsage(
    email: string,
    agentName: AgentName,
    date: string,
  ) {
    const oauthId = await this.resolveEmailToOauthId(email);
    const usageDate = this.parseDateParam(date);

    const dailyTokenUsage = await this.prisma.dailyTokenUsage.findUnique({
      where: {
        oauthId_agentName_date: { oauthId, agentName, date: usageDate },
      },
    });

    if (dailyTokenUsage) {
      return { ...dailyTokenUsage, recordExists: true };
    }

    return {
      id: null,
      oauthId,
      agentName,
      date: usageDate,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      createdAt: null,
      updatedAt: null,
      recordExists: false,
    };
  }

  async getAllUsage() {
    return this.prisma.userAgentTokenUsage.findMany({
      include: { user: { select: { email: true, username: true } } },
      orderBy: { totalUsedTokens: 'desc' },
    });
  }
}
