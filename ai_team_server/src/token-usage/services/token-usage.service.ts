import {
  Injectable,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AgentName } from '@prisma/client';
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

  async callClaude(opts: ClaudeCallOptions): Promise<Anthropic.Message> {
    const { oauthId, agentName, messages, system, maxTokens = 8096 } = opts;

    const record = await this.prisma.userAgentTokenUsage.findUnique({
      where: { oauthId_agentName: { oauthId, agentName } },
    });

    if (record && record.totalTokens >= record.tokenLimit) {
      throw new ForbiddenException(
        `Token limit of ${record.tokenLimit} reached for agent ${agentName}`,
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
      throw new InternalServerErrorException(`Claude API error: ${err?.message}`);
    }

    const input = response.usage?.input_tokens ?? 0;
    const output = response.usage?.output_tokens ?? 0;

    await this.prisma.userAgentTokenUsage.upsert({
      where: { oauthId_agentName: { oauthId, agentName } },
      create: {
        oauthId,
        agentName,
        inputTokens: input,
        outputTokens: output,
        totalTokens: input + output,
      },
      update: {
        inputTokens: { increment: input },
        outputTokens: { increment: output },
        totalTokens: { increment: input + output },
      },
    });

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
