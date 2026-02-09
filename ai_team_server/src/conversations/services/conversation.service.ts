import {
    Injectable,
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
    ConflictException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { Conversation, Message, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
    CreateConversationDto,
    UpdateConversationDto,
    AddMessageDto,
} from '../schemas/conversation.schema';

@Injectable()
export class ConversationService {
    constructor(private prisma: PrismaService) { }

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
                    const target = (error.meta?.target as string[])?.join(', ') || 'field';
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
                        message: 'Foreign key constraint failed. Referenced record does not exist.',
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
    // Helper: Get user by oauthId
    // ─────────────────────────────────────────────────────────────
    private async getUserByOauthId(oauthId: string) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { oauthId },
            });
            if (!user) {
                throw new NotFoundException({
                    statusCode: 404,
                    error: 'Not Found',
                    message: `User with OAuth ID "${oauthId}" not found. Please ensure the user exists before creating conversations.`,
                    hint: 'Create the user first via the /users endpoint.',
                });
            }
            return user;
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            this.handlePrismaError(error, 'getUserByOauthId');
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Create or update a conversation (upsert)
    // ─────────────────────────────────────────────────────────────
    async createConversation(
        oauthId: string,
        data: CreateConversationDto,
    ): Promise<Conversation> {
        try {
            const user = await this.getUserByOauthId(oauthId);
            const { messages, ...conversationData } = data;

            // Auto-fill time for messages if not provided
            const messagesWithTime = (messages || []).map(msg => ({
                ...msg,
                time: msg.time || this.getCurrentTime(),
            }));

            const conversation = await this.prisma.conversation.upsert({
                where: { id: data.id },
                create: {
                    ...conversationData,
                    userId: user.id,
                    messages: {
                        create: messagesWithTime,
                    },
                },
                update: {
                    ...conversationData,
                    lastUpdated: new Date(),
                },
                include: { messages: true },
            });

            return conversation;
        } catch (error) {
            if (error instanceof NotFoundException ||
                error instanceof BadRequestException ||
                error instanceof ConflictException) throw error;
            this.handlePrismaError(error, 'createConversation');
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Get all conversations for a user
    // ─────────────────────────────────────────────────────────────
    async findAllConversations(oauthId: string): Promise<Conversation[]> {
        try {
            const user = await this.getUserByOauthId(oauthId);

            return this.prisma.conversation.findMany({
                where: { userId: user.id },
                include: { messages: true },
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
    ): Promise<Conversation[]> {
        try {
            const user = await this.getUserByOauthId(oauthId);

            const conversations = await this.prisma.conversation.findMany({
                where: { userId: user.id, agentId },
                include: { messages: true },
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
    ): Promise<Conversation> {
        try {
            const user = await this.getUserByOauthId(oauthId);

            const conversation = await this.prisma.conversation.findFirst({
                where: { id: conversationId, userId: user.id },
                include: { messages: true },
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
    // Update a conversation
    // ─────────────────────────────────────────────────────────────
    async updateConversation(
        oauthId: string,
        conversationId: string,
        data: UpdateConversationDto,
    ): Promise<Conversation> {
        try {
            await this.findConversationById(oauthId, conversationId);

            return this.prisma.conversation.update({
                where: { id: conversationId },
                data: {
                    ...data,
                    lastUpdated: new Date(),
                },
                include: { messages: true },
            });
        } catch (error) {
            if (error instanceof NotFoundException ||
                error instanceof BadRequestException) throw error;
            this.handlePrismaError(error, 'updateConversation');
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Delete a conversation
    // ─────────────────────────────────────────────────────────────
    async deleteConversation(
        oauthId: string,
        conversationId: string,
    ): Promise<void> {
        try {
            await this.findConversationById(oauthId, conversationId);

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
    ): Promise<Message> {
        try {
            await this.findConversationById(oauthId, conversationId);

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
            if (error instanceof NotFoundException ||
                error instanceof BadRequestException) throw error;
            this.handlePrismaError(error, 'addMessage');
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Get all messages for a conversation
    // ─────────────────────────────────────────────────────────────
    async getMessages(
        oauthId: string,
        conversationId: string,
    ): Promise<Message[]> {
        try {
            await this.findConversationById(oauthId, conversationId);

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
    ): Promise<void> {
        try {
            await this.findConversationById(oauthId, conversationId);

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
    ): Promise<Conversation> {
        try {
            await this.findConversationById(oauthId, conversationId);

            return this.prisma.conversation.update({
                where: { id: conversationId },
                data: { archived, lastUpdated: new Date() },
                include: { messages: true },
            });
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            this.handlePrismaError(error, 'toggleArchive');
        }
    }
}
