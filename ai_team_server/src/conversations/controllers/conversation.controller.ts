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
  UpdateConversationTokensDto,
  updateConversationTokensSchema,
  SetUserTokenLimitDto,
  setUserTokenLimitSchema,
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
  @ApiOperation({
    summary: 'Create a conversation for a user by OAuth ID or email',
    description:
      'Creates the conversation and stamps it with the applicable token limit: tokenLimit and tokenLeft are set to that limit and tokenUsed to 0. If the user holds a team whose agents include this one and that team has a singleConversationTokenLimit above 0, the team’s number is used; otherwise the user’s own assigned limit is. A user with neither gets a conversation with no limit. Token counters are not part of the request body — set them per conversation with PATCH /conversations/{conversationId}/tokens, per user with PATCH /conversations/user/{email}/token-limit, or per team with PATCH /admin/groups/{id}. Re-posting an existing conversation ID updates it and leaves its counters alone.',
  })
  @ApiParam({
    name: 'oauthId',
    example: 'user_2abc123',
    description:
      'OAuth ID. You may also pass a URL-encoded email here, or use the optional email query parameter.',
  })
  @ApiQuery({
    name: 'email',
    required: false,
    example: 'user@gmail.com',
    description:
      'Optional user email/Gmail. When provided, it is used instead of oauthId.',
  })
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
    @Query('email') email: string | undefined,
    @Body(new ZodValidationPipe(createConversationSchema))
    createConversationDto: CreateConversationDto,
  ) {
    return this.conversationService.createConversation(
      oauthId,
      createConversationDto,
      email,
    );
  }

  // Get all conversations for a user (optionally filter by agentId)
  @Get(':oauthId')
  @ApiOperation({
    summary: 'List conversations for a user by OAuth ID or email',
  })
  @ApiParam({
    name: 'oauthId',
    example: 'user_2abc123',
    description:
      'OAuth ID. You may also pass a URL-encoded email here, or use the optional email query parameter.',
  })
  @ApiQuery({ name: 'agentId', required: false })
  @ApiQuery({
    name: 'email',
    required: false,
    example: 'user@gmail.com',
    description:
      'Optional user email/Gmail. When provided, it is used instead of oauthId.',
  })
  @ApiOkResponse({ description: 'Conversations returned' })
  findAll(
    @Param('oauthId') oauthId: string,
    @Query('agentId') agentId?: string,
    @Query('email') email?: string,
  ) {
    if (agentId) {
      return this.conversationService.findConversationsByAgent(
        oauthId,
        agentId,
        email,
      );
    }
    return this.conversationService.findAllConversations(oauthId, email);
  }

  // Get a single conversation by conversation ID alone.
  // Conversation IDs are globally unique, so no user identifier is needed.
  // The literal 'by-id' prefix keeps this off the ':oauthId' shape, and it MUST
  // stay declared above GET :oauthId/:conversationId — that route also matches
  // a two-segment path and would otherwise swallow this one.
  @Get('by-id/:conversationId')
  @ApiOperation({
    summary: 'Get one conversation by conversation ID',
    description:
      'Looks the conversation up on its ID alone, with no user identifier. Responds with the conversation’s own fields — title, agent, folder, archive state and token counters — and without its messages; fetch those from GET /conversations/{oauthId}/{conversationId}/messages.',
  })
  @ApiParam({ name: 'conversationId', example: 'chat_1765435414978' })
  @ApiOkResponse({ description: 'Conversation returned' })
  findOneById(@Param('conversationId') conversationId: string) {
    return this.conversationService.findConversationByConversationId(
      conversationId,
    );
  }

  // Get a single conversation by ID
  @Get(':oauthId/:conversationId')
  @ApiOperation({ summary: 'Get one conversation by OAuth ID or email' })
  @ApiParam({
    name: 'oauthId',
    example: 'user_2abc123',
    description:
      'OAuth ID. You may also pass a URL-encoded email here, or use the optional email query parameter.',
  })
  @ApiParam({ name: 'conversationId', example: 'chat_1765435414978' })
  @ApiQuery({
    name: 'email',
    required: false,
    example: 'user@gmail.com',
    description:
      'Optional user email/Gmail. When provided, it is used instead of oauthId.',
  })
  @ApiOkResponse({ description: 'Conversation returned' })
  findOne(
    @Param('oauthId') oauthId: string,
    @Param('conversationId') conversationId: string,
    @Query('email') email?: string,
  ) {
    return this.conversationService.findConversationById(
      oauthId,
      conversationId,
      email,
    );
  }

  // Update the token counters for a conversation.
  // Conversation IDs are globally unique, so no user identifier is needed.
  // MUST stay declared above PATCH :oauthId/:conversationId — that route also
  // matches a three-segment path and would otherwise swallow this one.
  @Patch(':conversationId/tokens')
  @ApiOperation({
    summary: 'Update token counters for a conversation',
    description:
      'Sets any combination of tokenLimit, tokenUsed and tokenLeft, keyed on the conversation ID alone. Omitted fields are left unchanged; an explicit null clears the field. Does not bump lastUpdated, so it will not reorder the chat list. Responds with the conversation without its messages.',
  })
  @ApiParam({ name: 'conversationId', example: 'chat_1765435414978' })
  @ApiBody({
    schema: {
      type: 'object',
      minProperties: 1,
      properties: {
        tokenLimit: {
          type: 'integer',
          nullable: true,
          minimum: 0,
          example: 100000,
          description: 'Total tokens allotted to this conversation.',
        },
        tokenUsed: {
          type: 'integer',
          nullable: true,
          minimum: 0,
          example: 2450,
          description: 'Tokens consumed so far.',
        },
        tokenLeft: {
          type: 'integer',
          nullable: true,
          minimum: 0,
          example: 97550,
          description: 'Tokens remaining.',
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Token counters updated' })
  updateTokens(
    @Param('conversationId') conversationId: string,
    @Body(new ZodValidationPipe(updateConversationTokensSchema))
    updateTokensDto: UpdateConversationTokensDto,
  ) {
    return this.conversationService.updateTokens(
      conversationId,
      updateTokensDto,
    );
  }

  // Assign one token limit to every conversation belonging to a user.
  // The literal 'user' prefix keeps this off the ':oauthId/:conversationId'
  // shape; the only other three-segment PATCH ends in 'archive', so there is
  // no overlap in either declaration order.
  @Patch('user/:email/token-limit')
  @ApiOperation({
    summary: 'Set one token limit across all of a user’s conversations',
    description:
      'Admin bulk assignment, keyed on email: applies a single tokenLimit to every conversation owned by that user, archived ones included, and stores it on the user so every conversation they create afterwards starts on the same limit. tokenLeft is recalculated per conversation as tokenLimit minus tokenUsed (never below 0); passing null clears both, and clears the limit for future conversations too. Works on a user with no conversations yet — conversationsUpdated is 0 but the limit still applies to their first chat. Does not bump lastUpdated, so the chat list keeps its order. Responds with the resolved user and the number of conversations updated.',
  })
  @ApiParam({
    name: 'email',
    example: 'user@gmail.com',
    description: 'Email of the user. Matching is case-insensitive.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['tokenLimit'],
      properties: {
        tokenLimit: {
          type: 'integer',
          nullable: true,
          minimum: 0,
          example: 100000,
          description:
            'Tokens allotted to each of the user’s conversations. Null clears the limit.',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Token limit applied to the user’s conversations',
  })
  setUserTokenLimit(
    @Param('email') email: string,
    @Body(new ZodValidationPipe(setUserTokenLimitSchema))
    setTokenLimitDto: SetUserTokenLimitDto,
  ) {
    return this.conversationService.setTokenLimitForUser(
      email,
      setTokenLimitDto,
    );
  }

  // Update a conversation
  @Patch(':oauthId/:conversationId')
  @ApiOperation({ summary: 'Update a conversation by OAuth ID or email' })
  @ApiParam({
    name: 'oauthId',
    example: 'user_2abc123',
    description:
      'OAuth ID. You may also pass a URL-encoded email here, or use the optional email query parameter.',
  })
  @ApiParam({ name: 'conversationId', example: 'chat_1765435414978' })
  @ApiQuery({
    name: 'email',
    required: false,
    example: 'user@gmail.com',
    description:
      'Optional user email/Gmail. When provided, it is used instead of oauthId.',
  })
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
    @Query('email') email: string | undefined,
    @Body(new ZodValidationPipe(updateConversationSchema))
    updateConversationDto: UpdateConversationDto,
  ) {
    return this.conversationService.updateConversation(
      oauthId,
      conversationId,
      updateConversationDto,
      email,
    );
  }

  // Delete a conversation
  @Delete(':oauthId/:conversationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a conversation by OAuth ID or email' })
  @ApiParam({
    name: 'oauthId',
    example: 'user_2abc123',
    description:
      'OAuth ID. You may also pass a URL-encoded email here, or use the optional email query parameter.',
  })
  @ApiParam({ name: 'conversationId', example: 'chat_1765435414978' })
  @ApiQuery({
    name: 'email',
    required: false,
    example: 'user@gmail.com',
    description:
      'Optional user email/Gmail. When provided, it is used instead of oauthId.',
  })
  @ApiNoContentResponse({ description: 'Conversation deleted' })
  remove(
    @Param('oauthId') oauthId: string,
    @Param('conversationId') conversationId: string,
    @Query('email') email?: string,
  ) {
    return this.conversationService.deleteConversation(
      oauthId,
      conversationId,
      email,
    );
  }

  // Archive/Unarchive a conversation
  @Patch(':oauthId/:conversationId/archive')
  @ApiOperation({
    summary: 'Archive or unarchive a conversation by OAuth ID or email',
  })
  @ApiParam({
    name: 'oauthId',
    example: 'user_2abc123',
    description:
      'OAuth ID. You may also pass a URL-encoded email here, or use the optional email query parameter.',
  })
  @ApiParam({ name: 'conversationId', example: 'chat_1765435414978' })
  @ApiQuery({
    name: 'email',
    required: false,
    example: 'user@gmail.com',
    description:
      'Optional user email/Gmail. When provided, it is used instead of oauthId.',
  })
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
    @Query('email') email: string | undefined,
    @Body('archived') archived: boolean,
  ) {
    return this.conversationService.toggleArchive(
      oauthId,
      conversationId,
      archived,
      email,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Message Endpoints
  // ─────────────────────────────────────────────────────────────

  // Add a message to a conversation
  @Post(':oauthId/:conversationId/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a message to a conversation by OAuth ID or email',
  })
  @ApiParam({
    name: 'oauthId',
    example: 'user_2abc123',
    description:
      'OAuth ID. You may also pass a URL-encoded email here, or use the optional email query parameter.',
  })
  @ApiParam({ name: 'conversationId', example: 'chat_1765435414978' })
  @ApiQuery({
    name: 'email',
    required: false,
    example: 'user@gmail.com',
    description:
      'Optional user email/Gmail. When provided, it is used instead of oauthId.',
  })
  @ApiBody({ schema: messageSchema })
  @ApiCreatedResponse({ description: 'Message added' })
  addMessage(
    @Param('oauthId') oauthId: string,
    @Param('conversationId') conversationId: string,
    @Query('email') email: string | undefined,
    @Body(new ZodValidationPipe(addMessageSchema))
    addMessageDto: AddMessageDto,
  ) {
    return this.conversationService.addMessage(
      oauthId,
      conversationId,
      addMessageDto,
      email,
    );
  }

  // Get all messages for a conversation
  @Get(':oauthId/:conversationId/messages')
  @ApiOperation({
    summary: 'List messages for a conversation by OAuth ID or email',
  })
  @ApiParam({
    name: 'oauthId',
    example: 'user_2abc123',
    description:
      'OAuth ID. You may also pass a URL-encoded email here, or use the optional email query parameter.',
  })
  @ApiParam({ name: 'conversationId', example: 'chat_1765435414978' })
  @ApiQuery({
    name: 'email',
    required: false,
    example: 'user@gmail.com',
    description:
      'Optional user email/Gmail. When provided, it is used instead of oauthId.',
  })
  @ApiOkResponse({ description: 'Messages returned' })
  getMessages(
    @Param('oauthId') oauthId: string,
    @Param('conversationId') conversationId: string,
    @Query('email') email?: string,
  ) {
    return this.conversationService.getMessages(oauthId, conversationId, email);
  }

  // Delete a message
  @Delete(':oauthId/:conversationId/messages/:messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a message by OAuth ID or email' })
  @ApiParam({
    name: 'oauthId',
    example: 'user_2abc123',
    description:
      'OAuth ID. You may also pass a URL-encoded email here, or use the optional email query parameter.',
  })
  @ApiParam({ name: 'conversationId', example: 'chat_1765435414978' })
  @ApiParam({ name: 'messageId' })
  @ApiQuery({
    name: 'email',
    required: false,
    example: 'user@gmail.com',
    description:
      'Optional user email/Gmail. When provided, it is used instead of oauthId.',
  })
  @ApiNoContentResponse({ description: 'Message deleted' })
  deleteMessage(
    @Param('oauthId') oauthId: string,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @Query('email') email?: string,
  ) {
    return this.conversationService.deleteMessage(
      oauthId,
      conversationId,
      messageId,
      email,
    );
  }
}
