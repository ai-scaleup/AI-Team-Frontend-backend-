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

@Controller('conversations')
export class ConversationController {
    constructor(private readonly conversationService: ConversationService) { }

    // Create a new conversation
    @Post(':oauthId')
    @HttpCode(HttpStatus.CREATED)
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
    findAll(
        @Param('oauthId') oauthId: string,
        @Query('agentId') agentId?: string,
    ) {
        if (agentId) {
            return this.conversationService.findConversationsByAgent(oauthId, agentId);
        }
        return this.conversationService.findAllConversations(oauthId);
    }

    // Get a single conversation by ID
    @Get(':oauthId/:conversationId')
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
    remove(
        @Param('oauthId') oauthId: string,
        @Param('conversationId') conversationId: string,
    ) {
        return this.conversationService.deleteConversation(oauthId, conversationId);
    }

    // Archive/Unarchive a conversation
    @Patch(':oauthId/:conversationId/archive')
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
    getMessages(
        @Param('oauthId') oauthId: string,
        @Param('conversationId') conversationId: string,
    ) {
        return this.conversationService.getMessages(oauthId, conversationId);
    }

    // Delete a message
    @Delete(':oauthId/:conversationId/messages/:messageId')
    @HttpCode(HttpStatus.NO_CONTENT)
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
