import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import OpenAI from 'openai';
import {
  AgentName,
  CompactionEventStatus,
  CompactionState,
  CompactionSummaryStyle,
} from 'src/generated/prisma/client';
import { conversationAgentIdToAgentName } from 'src/common/agent-slug';
import { PrismaService } from 'src/prisma/prisma.service';
import { API_MODEL_IDS } from 'src/token-alerts/constants/api-models';
import {
  buildSummaryPrompt,
  COMPACTION_NOTICE_SENDER,
  COMPACTION_NOTICE_TEXT,
  estimateTokens,
  LIMITS,
} from '../constants/compaction.constants';
import {
  CompactionContextDto,
  CompactionStatusDto,
  CompactionTurnDto,
} from '../dto/compaction.dto';
import {
  CompactionSettingsService,
  ResolvedCompactionSettings,
} from './compaction-settings.service';

const AGENT_NAMES = Object.values(AgentName) as AgentName[];

/** How the memory block is introduced inside the agent's system prompt. */
const MEMORY_BLOCK_HEADER =
  'CONVERSATION MEMORY (earlier messages in this chat, already summarised — treat as established fact and do not mention that a summary exists):';

@Injectable()
export class CompactionService {
  private readonly logger = new Logger(CompactionService.name);
  private readonly openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  /**
   * Chats currently being compacted. Two messages arriving together would
   * otherwise both cross the watermark and fold the same turns twice.
   * In-process only, which matches how this server is deployed; the worst a
   * second instance could do is write one redundant summary version.
   */
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: CompactionSettingsService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Identity
  // ─────────────────────────────────────────────────────────────

  /** Accepts `TONY`, `tony`, or the frontend slug `tony-ai`. */
  private parseAgent(value: unknown): AgentName {
    const raw = String(value ?? '').trim();
    if (!raw) throw new BadRequestException('agent is required');

    const asEnum = raw.toUpperCase().replace(/-/g, '_') as AgentName;
    if (AGENT_NAMES.includes(asEnum)) return asEnum;

    const fromSlug = conversationAgentIdToAgentName(raw);
    if (fromSlug) return fromSlug;

    throw new BadRequestException(`Unknown agent "${raw}"`);
  }

  private requireSessionId(value: unknown): string {
    const sessionId = String(value ?? '').trim();
    if (!sessionId) throw new BadRequestException('sessionId is required');
    return sessionId;
  }

  private async getOrCreateState(params: {
    sessionId: string;
    chatId: string;
    agentName: AgentName;
    email?: string | null;
    title?: string | null;
  }): Promise<CompactionState> {
    const { sessionId, chatId, agentName } = params;
    const email = params.email?.trim().toLowerCase() || null;
    const title = params.title?.trim() || null;

    return this.prisma.compactionState.upsert({
      where: {
        sessionId_chatId_agentName: { sessionId, chatId, agentName },
      },
      // An email or title that arrives on a later turn is filled in; one that
      // is missing never clears what is already stored.
      update: {
        email: email ?? undefined,
        title: title ?? undefined,
      },
      create: { sessionId, chatId, agentName, email, title },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Reading state
  // ─────────────────────────────────────────────────────────────

  private async getActiveSummary(stateId: string) {
    return this.prisma.compactionSummary.findFirst({
      where: { stateId },
      orderBy: { version: 'desc' },
    });
  }

  /** Tokens the model is being sent right now: memory block plus live turns. */
  private async computeLiveTokens(stateId: string): Promise<number> {
    const [summary, turns] = await Promise.all([
      this.getActiveSummary(stateId),
      this.prisma.compactionTurn.aggregate({
        where: { stateId, compacted: false },
        _sum: { tokenCount: true },
      }),
    ]);
    return (summary?.tokenCount ?? 0) + (turns._sum.tokenCount ?? 0);
  }

  private renderMemoryBlock(content: string | null | undefined): string {
    const trimmed = content?.trim();
    if (!trimmed) return '';
    return `${MEMORY_BLOCK_HEADER}\n\n${trimmed}`;
  }

  /**
   * What an agent workflow needs before it calls the model.
   *
   * Always answers, even when compaction is switched off or nothing has been
   * compacted yet — the workflow reads the same fields either way, so one
   * node covers both cases and a disabled feature is just an empty memory
   * block with the configured window.
   */
  async getContext(payload: CompactionContextDto) {
    const sessionId = this.requireSessionId(payload?.sessionId);
    const agentName = this.parseAgent(payload?.agent);
    const chatId = String(payload?.chatId ?? '').trim();

    const resolved = await this.settingsService.resolveForChat({
      agentName,
      email: payload?.email,
    });
    const { settings, conversationBudget } = resolved;

    const state = await this.getOrCreateState({
      sessionId,
      chatId,
      agentName,
      email: payload?.email,
      title: payload?.title,
    });

    const summary = await this.getActiveSummary(state.id);
    const liveTokens = await this.computeLiveTokens(state.id);

    const percentOfBudget = conversationBudget
      ? Math.round((state.totalTokens / conversationBudget) * 100)
      : 0;
    const percentOfWindow = conversationBudget
      ? Math.round((liveTokens / conversationBudget) * 100)
      : 0;

    return {
      enabled: settings.enabled,
      // The two numbers the workflow wires into its nodes.
      memoryBlock: this.renderMemoryBlock(summary?.content),
      keepLastTurns: settings.keepLastTurns,

      // Everything else is for logging, badges and the announcer bar.
      sessionId,
      chatId,
      agent: agentName,
      summaryVersion: summary?.version ?? 0,
      // True until the newest summary has travelled to the workflow inside a
      // chat message. The n8n agents take it once, when a compaction finished.
      summaryPending: (summary?.version ?? 0) > state.deliveredSummaryVersion,
      summaryTokens: summary?.tokenCount ?? 0,
      liveTokens,
      totalTokens: state.totalTokens,
      turnCount: state.turnCount,
      compactionCount: state.compactionCount,
      conversationBudget,
      percentOfBudget,
      percentOfWindow,
      watermarkPercent: settings.watermarkPercent,
      budgetExhausted:
        conversationBudget > 0 &&
        state.totalTokens >= conversationBudget,
      appliedFrom: {
        ownerType: resolved.ownerType,
        ownerId: resolved.ownerId,
        ownerLabel: resolved.ownerLabel,
      },
    };
  }

  /**
   * Where a chat's compaction stands, for the page that shows it. Read-only:
   * a chat the server has never seen answers with zeroes instead of creating
   * a state row.
   */
  async getStatus(payload: CompactionStatusDto) {
    const sessionId = this.requireSessionId(payload?.sessionId);
    const agentName = this.parseAgent(payload?.agent);
    const chatId = String(payload?.chatId ?? '').trim();

    const state = await this.prisma.compactionState.findUnique({
      where: { sessionId_chatId_agentName: { sessionId, chatId, agentName } },
    });
    if (!state) {
      return {
        compacting: false,
        compactionCount: 0,
        summaryVersion: 0,
        summaryPending: false,
        liveTokens: 0,
        threshold: 0,
        percentOfTrigger: 0,
        lastCompactedAt: null,
        lastEvent: null,
      };
    }

    const [summary, liveTokens, resolved, lastEvent] = await Promise.all([
      this.getActiveSummary(state.id),
      this.computeLiveTokens(state.id),
      this.settingsService.resolveForChat({ agentName, email: state.email }),
      this.prisma.compactionEvent.findFirst({
        where: { stateId: state.id },
        orderBy: { createdAt: 'desc' },
        select: {
          status: true,
          tokensBefore: true,
          tokensAfter: true,
          turnsCompacted: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      compacting: this.inFlight.has(state.id),
      compactionCount: state.compactionCount,
      summaryVersion: summary?.version ?? 0,
      summaryPending: (summary?.version ?? 0) > state.deliveredSummaryVersion,
      liveTokens,
      ...this.triggerProgress(liveTokens, resolved),
      lastCompactedAt: state.lastCompactedAt,
      lastEvent,
    };
  }

  /**
   * The token count at which a chat compacts, and how far towards it the chat
   * is (0-100) -- what a page needs to warn that a compaction is coming. Both
   * are zero when compaction is off or has no budget to measure against.
   */
  private triggerProgress(
    liveTokens: number,
    resolved: ResolvedCompactionSettings,
  ) {
    const { settings, conversationBudget } = resolved;
    const threshold =
      settings.enabled && conversationBudget
        ? Math.floor((conversationBudget * settings.watermarkPercent) / 100)
        : 0;

    return {
      threshold,
      percentOfTrigger:
        threshold > 0
          ? Math.min(Math.floor((liveTokens * 100) / threshold), 100)
          : 0,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Recording a turn
  // ─────────────────────────────────────────────────────────────

  /**
   * Appends a finished turn and starts a compaction when the chat has crossed
   * the watermark. Called after the model has already answered, and the
   * compaction itself runs in the background, so the cost of summarising
   * never sits in front of the user: the caller is told it started and
   * /compaction/status says when it is done.
   */
  async recordTurn(payload: CompactionTurnDto) {
    const sessionId = this.requireSessionId(payload?.sessionId);
    const agentName = this.parseAgent(payload?.agent);
    const chatId = String(payload?.chatId ?? '').trim();

    const userText = String(payload?.userText ?? '').trim();
    const aiText = String(payload?.aiText ?? '').trim();
    if (!userText && !aiText) {
      throw new BadRequestException('Provide userText and/or aiText');
    }

    const resolved = await this.settingsService.resolveForChat({
      agentName,
      email: payload?.email,
    });

    const state = await this.getOrCreateState({
      sessionId,
      chatId,
      agentName,
      email: payload?.email,
      title: payload?.title,
    });

    // Real provider usage when the caller has it, an estimate otherwise. The
    // per-row counts stay text-based either way, because they are what the
    // evicted slice is measured by.
    const userTokens = estimateTokens(userText);
    const aiTokens = estimateTokens(aiText);
    const deliveredVersion = Number.isInteger(payload?.deliveredSummaryVersion)
      ? (payload.deliveredSummaryVersion as number)
      : 0;
    const reportedTotal =
      typeof payload?.totalTokens === 'number'
        ? payload.totalTokens
        : (payload?.promptTokens ?? 0) + (payload?.completionTokens ?? 0);
    const spentTokens =
      reportedTotal > 0 ? reportedTotal : userTokens + aiTokens;

    await this.prisma.$transaction([
      ...(userText
        ? [
            this.prisma.compactionTurn.create({
              data: {
                stateId: state.id,
                role: 'user',
                text: userText,
                tokenCount: userTokens,
              },
            }),
          ]
        : []),
      ...(aiText
        ? [
            this.prisma.compactionTurn.create({
              data: {
                stateId: state.id,
                role: 'ai',
                text: aiText,
                tokenCount: aiTokens,
              },
            }),
          ]
        : []),
      this.prisma.compactionState.update({
        where: { id: state.id },
        data: {
          turnCount: { increment: 1 },
          totalTokens: { increment: spentTokens },
          // The workflow answered a message that carried this summary, so it
          // has it now and the next messages go without.
          ...(deliveredVersion > state.deliveredSummaryVersion
            ? { deliveredSummaryVersion: deliveredVersion }
            : {}),
        },
      }),
    ]);

    const [liveTokens, liveRows, summary] = await Promise.all([
      this.computeLiveTokens(state.id),
      this.prisma.compactionTurn.count({
        where: { stateId: state.id, compacted: false },
      }),
      this.getActiveSummary(state.id),
    ]);
    const { settings, conversationBudget } = resolved;

    const trigger = this.triggerProgress(liveTokens, resolved);
    const overWatermark =
      trigger.threshold > 0 && liveTokens >= trigger.threshold;
    // Nothing older than the recency window means nothing to fold in yet.
    const shouldCompact =
      overWatermark && liveRows > settings.keepLastTurns * 2;

    const progress = {
      liveTokens,
      ...trigger,
      conversationBudget,
      // What the chat stood at before any compaction this turn starts, so the
      // caller can tell when a new one has landed.
      compactionCount: state.compactionCount,
      summaryVersion: summary?.version ?? 0,
    };

    if (!shouldCompact) {
      await this.prisma.compactionState.update({
        where: { id: state.id },
        data: { liveTokens },
      });
      return {
        compacting: this.inFlight.has(state.id),
        ...progress,
        reason: !settings.enabled
          ? 'disabled'
          : overWatermark
            ? 'nothing-to-evict'
            : 'below-watermark',
      };
    }

    void this.compact(state.id, resolved, {
      notifyChat: payload?.notifyChat === true,
    }).catch((error) => {
      this.logger.error(
        `Compaction failed for ${sessionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });

    return { compacting: true, ...progress };
  }

  // ─────────────────────────────────────────────────────────────
  // Compaction
  // ─────────────────────────────────────────────────────────────

  /**
   * Folds everything older than the recency window into one summary.
   *
   * The new summary is written from the previous one plus only the turns
   * being evicted, so each compaction costs the same no matter how long the
   * chat has run. Turn rows are never deleted — they are marked `compacted`,
   * which is what lets the user keep reading the full history while the model
   * sees only the tail.
   */
  async compact(
    stateId: string,
    resolved: ResolvedCompactionSettings,
    options: { notifyChat?: boolean } = {},
  ) {
    if (this.inFlight.has(stateId)) {
      return { status: 'skipped' as const, reason: 'already-running' };
    }
    this.inFlight.add(stateId);

    try {
      const state = await this.prisma.compactionState.findUnique({
        where: { id: stateId },
      });
      if (!state) throw new NotFoundException('Compaction state not found');

      const { settings, conversationBudget } = resolved;

      const liveTurns = await this.prisma.compactionTurn.findMany({
        where: { stateId, compacted: false },
        orderBy: { createdAt: 'asc' },
      });

      // One turn is a user message and the reply to it, so the recency window
      // is counted in rows, not in turns.
      const keepRows = settings.keepLastTurns * 2;
      const evicted = liveTurns.slice(
        0,
        Math.max(liveTurns.length - keepRows, 0),
      );

      if (evicted.length === 0) {
        await this.prisma.compactionState.update({
          where: { id: stateId },
          data: { liveTokens: await this.computeLiveTokens(stateId) },
        });
        return { status: 'skipped' as const, reason: 'nothing-to-evict' };
      }

      const tokensBefore = await this.computeLiveTokens(stateId);
      const previous = await this.getActiveSummary(stateId);

      const transcripts = this.chunkTranscript(evicted);

      let content: string | null = null;
      let costTokens = 0;
      let status: CompactionEventStatus = CompactionEventStatus.OK;
      let detail: string | null = null;

      try {
        // One call per chunk, each folding its turns into the summary the
        // previous call returned, so nothing evicted is left out however
        // much has piled up before the watermark.
        for (const transcript of transcripts) {
          const completion = await this.openai.chat.completions.create({
            model: API_MODEL_IDS[this.settingsService.modelFor(settings)],
            messages: [
              {
                role: 'user',
                content: buildSummaryPrompt({
                  agentName: state.agentName,
                  structured:
                    settings.summaryStyle === CompactionSummaryStyle.STRUCTURED,
                  maxTokens: settings.memoryCapTokens,
                  previousSummary: content ?? previous?.content ?? null,
                  transcript,
                }),
              },
            ],
            temperature: 0.2,
          });

          content =
            completion.choices[0]?.message?.content?.trim() || content;
          costTokens += completion.usage?.total_tokens ?? 0;
        }
      } catch (error) {
        // Never fail the chat over a memory optimisation: the evicted turns
        // are dropped anyway (plain truncation) and the summary keeps whatever
        // was folded in before the failure, or stays as it was -- the same
        // context the model would have had one turn earlier.
        status = CompactionEventStatus.FALLBACK;
        detail = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Compaction fell back to truncation for ${state.sessionId}: ${detail}`,
        );
      }

      if (content && content.length > LIMITS.summaryChars) {
        content = content.slice(0, LIMITS.summaryChars);
      }

      const summaryTokens = content
        ? estimateTokens(content)
        : (previous?.tokenCount ?? 0);

      const writes: Promise<unknown>[] = [];

      if (content) {
        writes.push(
          this.prisma.compactionSummary.create({
            data: {
              stateId,
              version: (previous?.version ?? 0) + 1,
              content,
              tokenCount: summaryTokens,
              coversTurnCount:
                (previous?.coversTurnCount ?? 0) + evicted.length,
            },
          }),
        );
      }

      writes.push(
        this.prisma.compactionTurn.updateMany({
          where: { id: { in: evicted.map((turn) => turn.id) } },
          data: { compacted: true },
        }),
      );

      await Promise.all(writes);

      const tokensAfter = await this.computeLiveTokens(stateId);

      await this.prisma.compactionState.update({
        where: { id: stateId },
        data: {
          liveTokens: tokensAfter,
          compactionCount: { increment: 1 },
          lastCompactedAt: new Date(),
        },
      });

      await this.prisma.compactionEvent.create({
        data: {
          stateId,
          sessionId: state.sessionId,
          chatId: state.chatId,
          agentName: state.agentName,
          email: state.email,
          title: state.title,
          tokensBefore,
          tokensAfter,
          turnsCompacted: evicted.length,
          summaryTokens,
          costTokens,
          status,
          apiModel: this.settingsService.modelFor(settings),
          detail,
        },
      });

      // Only a compaction that produced a summary changes what the agent is
      // told, so only that one is announced in the chat.
      if (content && options.notifyChat) {
        await this.writeChatNotice(state.chatId);
      }

      return {
        status,
        tokensBefore,
        tokensAfter,
        turnsCompacted: evicted.length,
        summaryTokens,
        costTokens,
        conversationBudget,
      };
    } finally {
      this.inFlight.delete(stateId);
    }
  }

  /**
   * Splits the evicted turns into transcripts the summarising model can read
   * in one call each. A turn longer than a whole chunk (a pasted file) is cut
   * across chunks instead of being dropped.
   */
  private chunkTranscript(turns: { role: string; text: string }[]): string[] {
    const limit = LIMITS.transcriptChunkChars;
    const chunks: string[] = [];
    let current = '';

    for (const turn of turns) {
      let line = `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.text}`;

      while (line.length > limit) {
        if (current) {
          chunks.push(current);
          current = '';
        }
        chunks.push(line.slice(0, limit));
        line = line.slice(limit);
      }

      if (current && current.length + line.length + 2 > limit) {
        chunks.push(current);
        current = '';
      }
      current = current ? `${current}\n\n${line}` : line;
    }

    if (current) chunks.push(current);
    return chunks;
  }

  /**
   * Marks the spot in the chat's own transcript where it was compacted. Only
   * chats that own a Conversation row get one, and a failure here is logged
   * and dropped: the compaction itself already succeeded.
   */
  private async writeChatNotice(chatId: string) {
    if (!chatId) return;

    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: chatId },
        select: { id: true },
      });
      if (!conversation) return;

      await this.prisma.message.create({
        data: {
          conversationId: chatId,
          sender: COMPACTION_NOTICE_SENDER,
          text: COMPACTION_NOTICE_TEXT,
          time: '',
        },
      });
    } catch (error) {
      this.logger.warn(
        `Could not write the compaction notice for ${chatId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Admin reads
  // ─────────────────────────────────────────────────────────────

  /** The panel's "Recent compactions" list. */
  async listEvents(limit?: unknown) {
    const parsed = Number(limit ?? 25);
    const take =
      Number.isInteger(parsed) && parsed > 0 && parsed <= 200 ? parsed : 25;

    return this.prisma.compactionEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  /** Headline numbers above the log. */
  async getStats() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [events, totals, activeChats] = await Promise.all([
      this.prisma.compactionEvent.count({
        where: { createdAt: { gte: since } },
      }),
      this.prisma.compactionEvent.aggregate({
        where: { createdAt: { gte: since } },
        _sum: { tokensBefore: true, tokensAfter: true, costTokens: true },
      }),
      this.prisma.compactionState.count({
        where: { updatedAt: { gte: since } },
      }),
    ]);

    const before = totals._sum.tokensBefore ?? 0;
    const after = totals._sum.tokensAfter ?? 0;

    return {
      windowHours: 24,
      compactions: events,
      activeChats,
      tokensBefore: before,
      tokensAfter: after,
      tokensSaved: Math.max(before - after, 0),
      savingPercent:
        before > 0 ? Math.round(((before - after) / before) * 100) : 0,
      costTokens: totals._sum.costTokens ?? 0,
    };
  }
}
