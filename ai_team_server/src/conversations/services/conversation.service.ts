import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Conversation, Message, Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { conversationAgentIdToAgentName } from 'src/common/agent-slug';
import {
  CreateConversationDto,
  UpdateConversationDto,
  UpdateConversationTokensDto,
  SetUserTokenLimitDto,
  AddMessageDto,
} from '../schemas/conversation.schema';

@Injectable()
export class ConversationService {
  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────
  // Helper: Generate current time string (HH:mm format)
  // ─────────────────────────────────────────────────────────────
  private getCurrentTime(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // ─────────────────────────────────────────────────────────────
  // Error Handler - Converts Prisma errors to proper HTTP errors
  // ─────────────────────────────────────────────────────────────
  private handlePrismaError(error: unknown, context: string): never {
    // Handle Prisma known request errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P1001':
          throw new ServiceUnavailableException({
            statusCode: 503,
            error: 'Service Unavailable',
            message: 'Database server is unreachable. Please try again later.',
            code: error.code,
          });
        case 'P1002':
          throw new ServiceUnavailableException({
            statusCode: 503,
            error: 'Service Unavailable',
            message: 'Database connection timed out. Please try again.',
            code: error.code,
          });
        case 'P2002':
          const target =
            (error.meta?.target as string[])?.join(', ') || 'field';
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            message: `A record with this ${target} already exists.`,
            code: error.code,
            context,
          });
        case 'P2003':
          throw new BadRequestException({
            statusCode: 400,
            error: 'Bad Request',
            message:
              'Foreign key constraint failed. Referenced record does not exist.',
            code: error.code,
            context,
          });
        case 'P2025':
          throw new NotFoundException({
            statusCode: 404,
            error: 'Not Found',
            message: 'Record not found or has already been deleted.',
            code: error.code,
            context,
          });
        default:
          throw new InternalServerErrorException({
            statusCode: 500,
            error: 'Internal Server Error',
            message: `Database error occurred: ${error.message}`,
            code: error.code,
            context,
          });
      }
    }

    // Handle Prisma validation errors
    if (error instanceof Prisma.PrismaClientValidationError) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid data provided. Please check your request.',
        details: error.message.split('\n').slice(-3).join(' ').trim(),
        context,
      });
    }

    // Handle Prisma initialization errors
    if (error instanceof Prisma.PrismaClientInitializationError) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'Database connection failed. Please try again later.',
        code: error.errorCode,
        context,
      });
    }

    // Handle general errors
    if (error instanceof Error) {
      throw new InternalServerErrorException({
        statusCode: 500,
        error: 'Internal Server Error',
        message: error.message || 'An unexpected error occurred.',
        context,
      });
    }

    // Fallback for unknown errors
    throw new InternalServerErrorException({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred.',
      context,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Helper: Get user by oauthId or email
  // ─────────────────────────────────────────────────────────────
  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async getUserByEmail(email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        message: `User with email "${normalizedEmail}" not found. Please ensure the user exists before creating conversations.`,
        hint: 'Create the user first via the /users endpoint.',
      });
    }

    return user;
  }

  private async getUserByIdentifier(userIdentifier: string, email?: string) {
    try {
      if (email?.trim()) {
        return await this.getUserByEmail(email);
      }

      const identifier = userIdentifier.trim();
      const user = await this.prisma.user.findUnique({
        where: { oauthId: identifier },
      });

      if (user) {
        return user;
      }

      if (identifier.includes('@')) {
        return await this.getUserByEmail(identifier);
      }

      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        message: `User with OAuth ID "${identifier}" not found. Please ensure the user exists before creating conversations.`,
        hint: 'Create the user first via the /users endpoint, or pass ?email=user@gmail.com.',
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.handlePrismaError(error, 'getUserByIdentifier');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Helper: the per-conversation allowance a user's teams grant an agent
  // ─────────────────────────────────────────────────────────────
  // Null when no team the user currently holds has a number set for this
  // agent, which leaves the caller on the user-level limit.
  //
  // A group sitting at 0 is excluded: 0 is the column default and means "no
  // team allowance configured", not "this agent may spend nothing". Expired and
  // deactivated assignments are excluded the same way getSelectedAgentsByEmail
  // reads them, so a lapsed team stops granting its allowance.
  //
  // When two teams the user holds both cover the agent, the larger allowance
  // wins — holding a second team should not cost the user tokens.
  private async resolveTeamTokenLimit(
    userId: string,
    agentId: string,
  ): Promise<number | null> {
    const agentName = conversationAgentIdToAgentName(agentId);
    if (!agentName) return null;

    const now = new Date();
    const groups = await this.prisma.agentGroup.findMany({
      where: {
        singleConversationTokenLimit: { gt: 0 },
        items: { some: { agentName } },
        assignments: {
          some: {
            userId,
            isActive: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        },
      },
      select: { singleConversationTokenLimit: true },
    });

    if (groups.length === 0) return null;
    return Math.max(...groups.map((g) => g.singleConversationTokenLimit));
  }

  // ─────────────────────────────────────────────────────────────
  // Create or update a conversation (upsert)
  // ─────────────────────────────────────────────────────────────
  async createConversation(
    oauthId: string,
    data: CreateConversationDto,
    email?: string,
  ): Promise<Conversation> {
    try {
      const user = await this.getUserByIdentifier(oauthId, email);
      const { messages, ...conversationData } = data;

      // Auto-fill time for messages if not provided
      const messagesWithTime = (messages || []).map((msg) => ({
        ...msg,
        time: msg.time || this.getCurrentTime(),
      }));

      // A new chat opens on the user's assigned allowance. The limit belongs to
      // the user, so a conversation started after an admin set it must not be
      // the one chat that runs unmetered. tokenUsed starts at 0 and tokenLeft
      // at the full limit, which keeps the three counters consistent from the
      // first message instead of only once something writes them.
      //
      // A team the user holds overrides that for its own agents: the team's
      // singleConversationTokenLimit is the allowance the assignment granted,
      // so a chat with one of its agents opens on the team's number rather than
      // the user's. Everything else — an agent on no team the user holds, or a
      // team with no number set — still falls back to the user's own limit.
      //
      // Only the create branch gets these: an upsert that lands on an existing
      // conversation would otherwise wipe usage that has already accrued.
      const teamTokenLimit = await this.resolveTeamTokenLimit(
        user.id,
        data.agentId,
      );
      const openingTokenLimit = teamTokenLimit ?? user.tokenLimit;

      const inheritedTokens =
        openingTokenLimit === null
          ? {}
          : {
              tokenLimit: openingTokenLimit,
              tokenUsed: 0,
              tokenLeft: openingTokenLimit,
            };

      const conversation = await this.prisma.conversation.upsert({
        where: { id: data.id },
        create: {
          ...conversationData,
          ...inheritedTokens,
          userId: user.id,
          messages: {
            create: messagesWithTime,
          },
        },
        update: {
          ...conversationData,
          lastUpdated: new Date(),
        },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });

      return conversation;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ConflictException
      )
        throw error;
      this.handlePrismaError(error, 'createConversation');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Get all conversations for a user
  // ─────────────────────────────────────────────────────────────
  async findAllConversations(
    oauthId: string,
    email?: string,
  ): Promise<Conversation[]> {
    try {
      const user = await this.getUserByIdentifier(oauthId, email);

      return this.prisma.conversation.findMany({
        where: { userId: user.id },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
        orderBy: { lastUpdated: 'desc' },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.handlePrismaError(error, 'findAllConversations');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Get conversations by agentId for a user
  // ─────────────────────────────────────────────────────────────
  async findConversationsByAgent(
    oauthId: string,
    agentId: string,
    email?: string,
  ): Promise<Conversation[]> {
    try {
      const user = await this.getUserByIdentifier(oauthId, email);

      const conversations = await this.prisma.conversation.findMany({
        where: { userId: user.id, agentId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
        orderBy: { lastUpdated: 'desc' },
      });

      if (conversations.length === 0) {
        // Return empty array but log info (not an error)
        return [];
      }

      return conversations;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.handlePrismaError(error, 'findConversationsByAgent');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Get a single conversation by ID
  // ─────────────────────────────────────────────────────────────
  async findConversationById(
    oauthId: string,
    conversationId: string,
    email?: string,
  ): Promise<Conversation> {
    try {
      const user = await this.getUserByIdentifier(oauthId, email);

      const conversation = await this.prisma.conversation.findFirst({
        where: { id: conversationId, userId: user.id },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });

      if (!conversation) {
        throw new NotFoundException({
          statusCode: 404,
          error: 'Not Found',
          message: `Conversation with ID "${conversationId}" not found.`,
          hint: 'Ensure the conversation ID is correct and belongs to this user.',
        });
      }

      return conversation;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.handlePrismaError(error, 'findConversationById');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Get a single conversation by ID alone
  // ─────────────────────────────────────────────────────────────
  // Keyed on the conversation ID only — it is the primary key, so it already
  // identifies the row without resolving a user first, the same way
  // updateTokens works.
  //
  // Messages are deliberately not included: this returns the conversation's own
  // fields, and a chat's transcript can run to hundreds of long messages that
  // callers after the metadata would pay for and discard. Fetch them from
  // GET :oauthId/:conversationId/messages when they are actually wanted.
  async findConversationByConversationId(
    conversationId: string,
  ): Promise<Conversation> {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        throw new NotFoundException({
          statusCode: 404,
          error: 'Not Found',
          message: `Conversation with ID "${conversationId}" not found.`,
          hint: 'Ensure the conversation ID is correct.',
        });
      }

      return conversation;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.handlePrismaError(error, 'findConversationByConversationId');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Update a conversation
  // ─────────────────────────────────────────────────────────────
  async updateConversation(
    oauthId: string,
    conversationId: string,
    data: UpdateConversationDto,
    email?: string,
  ): Promise<Conversation> {
    try {
      await this.findConversationById(oauthId, conversationId, email);

      return this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          ...data,
          lastUpdated: new Date(),
        },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      this.handlePrismaError(error, 'updateConversation');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Update a conversation's token counters
  // ─────────────────────────────────────────────────────────────
  // Keyed on the conversation ID alone — it is the primary key, so it already
  // identifies the row without a user lookup.
  async updateTokens(
    conversationId: string,
    data: UpdateConversationTokensDto,
  ): Promise<Conversation> {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true },
      });

      if (!conversation) {
        throw new NotFoundException({
          statusCode: 404,
          error: 'Not Found',
          message: `Conversation with ID "${conversationId}" not found.`,
          hint: 'Ensure the conversation ID is correct.',
        });
      }

      // `lastUpdated` is deliberately not touched: it drives chat-list ordering,
      // and token accounting is bookkeeping rather than user activity.
      // Messages are not included either — this is a hot path and the caller
      // only needs the counters back.
      return this.prisma.conversation.update({
        where: { id: conversationId },
        data,
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      this.handlePrismaError(error, 'updateTokens');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Assign one token limit to every conversation a user owns
  // ─────────────────────────────────────────────────────────────
  // Admin-facing bulk quota assignment, keyed on email rather than on a
  // conversation. Applies to all of the user's conversations, archived ones
  // included — an archived chat can be restored, so leaving it on the old limit
  // would reopen a hole in the quota.
  async setTokenLimitForUser(
    email: string,
    data: SetUserTokenLimitDto,
  ): Promise<{
    oauthId: string;
    email: string | null;
    tokenLimit: number | null;
    conversationsUpdated: number;
  }> {
    try {
      // Reject a non-email path segment up front. Without this an OAuth ID
      // falls through to a 404 phrased as "user with email ... not found",
      // which reads like the account is missing rather than the input being
      // the wrong kind of value.
      if (!email?.includes('@')) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message: `"${email}" is not an email address.`,
          hint: 'This endpoint is keyed on email, for example /conversations/user/user@gmail.com/token-limit.',
        });
      }

      const user = await this.getUserByEmail(email);
      const { tokenLimit } = data;

      // tokenLeft is recalculated in the same statement: a fresh limit paired
      // with a stale "remaining" is worse than no limit at all. Doing the
      // arithmetic in SQL keeps it per-row and atomic — updateMany cannot read
      // tokenUsed while writing tokenLeft.
      //
      // GREATEST(..., 0) covers conversations that already burned past the new
      // limit, so tokenLeft never goes negative.
      //
      // lastUpdated is deliberately untouched, matching updateTokens: an admin
      // assigning quota should not reshuffle the user's chat list.
      //
      // The limit is also stored on the user, in the same transaction. That
      // copy is what new conversations inherit, so writing only the rows that
      // exist today would leave tomorrow's chats unlimited — and would drop the
      // assignment entirely for a user who has not started a chat yet.
      const [, conversationsUpdated] = await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: user.id },
          data: { tokenLimit },
        }),
        tokenLimit === null
          ? this.prisma.$executeRaw`
              UPDATE "Conversation"
              SET "tokenLimit" = NULL, "tokenLeft" = NULL
              WHERE "userId" = ${user.id}`
          : this.prisma.$executeRaw`
              UPDATE "Conversation"
              SET "tokenLimit" = ${tokenLimit},
                  "tokenLeft" = GREATEST(${tokenLimit} - COALESCE("tokenUsed", 0), 0)
              WHERE "userId" = ${user.id}`,
      ]);

      return {
        oauthId: user.oauthId,
        email: user.email,
        tokenLimit,
        conversationsUpdated,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      this.handlePrismaError(error, 'setTokenLimitForUser');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Delete a conversation
  // ─────────────────────────────────────────────────────────────
  async deleteConversation(
    oauthId: string,
    conversationId: string,
    email?: string,
  ): Promise<void> {
    try {
      await this.findConversationById(oauthId, conversationId, email);

      await this.prisma.conversation.delete({
        where: { id: conversationId },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.handlePrismaError(error, 'deleteConversation');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Add a message to a conversation
  // ─────────────────────────────────────────────────────────────
  async addMessage(
    oauthId: string,
    conversationId: string,
    data: AddMessageDto,
    email?: string,
  ): Promise<Message> {
    try {
      await this.findConversationById(oauthId, conversationId, email);

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastUpdated: new Date() },
      });

      // Auto-fill time if not provided
      const messageData = {
        ...data,
        time: data.time || this.getCurrentTime(),
        conversationId,
      };

      return this.prisma.message.create({
        data: messageData,
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      this.handlePrismaError(error, 'addMessage');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Get all messages for a conversation
  // ─────────────────────────────────────────────────────────────
  async getMessages(
    oauthId: string,
    conversationId: string,
    email?: string,
  ): Promise<Message[]> {
    try {
      await this.findConversationById(oauthId, conversationId, email);

      return this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.handlePrismaError(error, 'getMessages');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Delete a message
  // ─────────────────────────────────────────────────────────────
  async deleteMessage(
    oauthId: string,
    conversationId: string,
    messageId: string,
    email?: string,
  ): Promise<void> {
    try {
      await this.findConversationById(oauthId, conversationId, email);

      const message = await this.prisma.message.findFirst({
        where: { id: messageId, conversationId },
      });

      if (!message) {
        throw new NotFoundException({
          statusCode: 404,
          error: 'Not Found',
          message: `Message with ID "${messageId}" not found in this conversation.`,
          hint: 'Ensure the message ID is correct and belongs to this conversation.',
        });
      }

      await this.prisma.message.delete({
        where: { id: messageId },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.handlePrismaError(error, 'deleteMessage');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Archive/Unarchive a conversation
  // ─────────────────────────────────────────────────────────────
  async toggleArchive(
    oauthId: string,
    conversationId: string,
    archived: boolean,
    email?: string,
  ): Promise<Conversation> {
    try {
      await this.findConversationById(oauthId, conversationId, email);

      return this.prisma.conversation.update({
        where: { id: conversationId },
        data: { archived, lastUpdated: new Date() },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.handlePrismaError(error, 'toggleArchive');
    }
  }
}
