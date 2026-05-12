import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ConversationService } from '../services/conversation.service';
import {
  CreateConversationDto,
  createConversationSchema,
  UpdateConversationDto,
  updateConversationSchema,
  AddMessageDto,
  addMessageSchema,
} from '../schemas/conversation.schema';
import { ZodValidationPipe } from 'src/pipes/zod.validation.pipe';

const messageSchema = {
  type: 'object',
  required: ['text', 'sender'],
  properties: {
    text: { type: 'string', example: 'Hello' },
    sender: { type: 'string', enum: ['ai', 'user'], example: 'user' },
    time: { type: 'string', example: '2026-04-27T10:00:00.000Z' },
  },
};

@ApiTags('conversations')
@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  // Create a new conversation
  @Post(':oauthId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a conversation for a user' })
  @ApiParam({ name: 'oauthId', example: 'user_2abc123' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['id', 'title', 'agentId', 'sessionId'],
      properties: {
        id: { type: 'string', example: 'chat_1765435414978' },
        title: { type: 'string', example: 'New chat' },
        agentId: { type: 'string', example: 'JIM' },
        sessionId: { type: 'string', example: 'session_123' },
        folderId: { type: 'string', nullable: true, example: null },
        archived: { type: 'boolean', example: false },
        messages: { type: 'array', items: messageSchema },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Conversation created' })
  create(
    @Param('oauthId') oauthId: string,
    @Body(new ZodValidationPipe(createConversationSchema))
    createConversationDto: CreateConversationDto,
  ) {
    return this.conversationService.createConversation(
      oauthId,
      createConversationDto,
    );
  }

  // Get all conversations for a user (optionally filter by agentId)
  @Get(':oauthId')
  @ApiOperation({ summary: 'List conversations for a user' })
  @ApiParam({ name: 'oauthId', example: 'user_2abc123' })
  @ApiQuery({ name: 'agentId', required: false })
  @ApiOkResponse({ description: 'Conversations returned' })
  findAll(
    @Param('oauthId') oauthId: string,
    @Query('agentId') agentId?: string,
  ) {
    if (agentId) {
      return this.conversationService.findConversationsByAgent(
        oauthId,
        agentId,
      );
    }
    return this.conversationService.findAllConversations(oauthId);
  }

  // Get a single conversation by ID
  @Get(':oauthId/:conversationId')
  @ApiOperation({ summary: 'Get one conversation' })
  @ApiParam({ name: 'oauthId', example: 'user_2abc123' })
  @ApiParam({ name: 'conversationId', example: 'chat_1765435414978' })
  @ApiOkResponse({ description: 'Conversation returned' })
  findOne(
    @Param('oauthId') oauthId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.conversationService.findConversationById(
      oauthId,
      conversationId,
    );
  }

  // Update a conversation
  @Patch(':oauthId/:conversationId')
  @ApiOperation({ summary: 'Update a conversation' })
  @ApiParam({ name: 'oauthId', example: 'user_2abc123' })
  @ApiParam({ name: 'conversationId', example: 'chat_1765435414978' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Updated chat' },
        folderId: { type: 'string', nullable: true, example: null },
        archived: { type: 'boolean', example: false },
        lastUpdated: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiOkResponse({ description: 'Conversation updated' })
  update(
    @Param('oauthId') oauthId: string,
    @Param('conversationId') conversationId: string,
    @Body(new ZodValidationPipe(updateConversationSchema))
    updateConversationDto: UpdateConversationDto,
  ) {
    return this.conversationService.updateConversation(
      oauthId,
      conversationId,
      updateConversationDto,
    );
  }

  // Delete a conversation
  @Delete(':oauthId/:conversationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiParam({ name: 'oauthId', example: 'user_2abc123' })
  @ApiParam({ name: 'conversationId', example: 'chat_1765435414978' })
  @ApiNoContentResponse({ description: 'Conversation deleted' })
  remove(
    @Param('oauthId') oauthId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.conversationService.deleteConversation(oauthId, conversationId);
  }

  // Archive/Unarchive a conversation
  @Patch(':oauthId/:conversationId/archive')
  @ApiOperation({ summary: 'Archive or unarchive a conversation' })
  @ApiParam({ name: 'oauthId', example: 'user_2abc123' })
  @ApiParam({ name: 'conversationId', example: 'chat_1765435414978' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archived'],
      properties: { archived: { type: 'boolean', example: true } },
    },
  })
  @ApiOkResponse({ description: 'Archive state updated' })
  toggleArchive(
    @Param('oauthId') oauthId: string,
    @Param('conversationId') conversationId: string,
    @Body('archived') archived: boolean,
  ) {
    return this.conversationService.toggleArchive(
      oauthId,
      conversationId,
      archived,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Message Endpoints
  // ─────────────────────────────────────────────────────────────

  // Add a message to a conversation
  @Post(':oauthId/:conversationId/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a message to a conversation' })
  @ApiParam({ name: 'oauthId', example: 'user_2abc123' })
  @ApiParam({ name: 'conversationId', example: 'chat_1765435414978' })
  @ApiBody({ schema: messageSchema })
  @ApiCreatedResponse({ description: 'Message added' })
  addMessage(
    @Param('oauthId') oauthId: string,
    @Param('conversationId') conversationId: string,
    @Body(new ZodValidationPipe(addMessageSchema))
    addMessageDto: AddMessageDto,
  ) {
    return this.conversationService.addMessage(
      oauthId,
      conversationId,
      addMessageDto,
    );
  }

  // Get all messages for a conversation
  @Get(':oauthId/:conversationId/messages')
  @ApiOperation({ summary: 'List messages for a conversation' })
  @ApiParam({ name: 'oauthId', example: 'user_2abc123' })
  @ApiParam({ name: 'conversationId', example: 'chat_1765435414978' })
  @ApiOkResponse({ description: 'Messages returned' })
  getMessages(
    @Param('oauthId') oauthId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.conversationService.getMessages(oauthId, conversationId);
  }

  // Delete a message
  @Delete(':oauthId/:conversationId/messages/:messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a message' })
  @ApiParam({ name: 'oauthId', example: 'user_2abc123' })
  @ApiParam({ name: 'conversationId', example: 'chat_1765435414978' })
  @ApiParam({ name: 'messageId' })
  @ApiNoContentResponse({ description: 'Message deleted' })
  deleteMessage(
    @Param('oauthId') oauthId: string,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.conversationService.deleteMessage(
      oauthId,
      conversationId,
      messageId,
    );
  }
}
