import { Controller, Get, Param } from '@nestjs/common';
import { SaraAiService } from '../services/sara-ai.service';

@Controller('sara-ai')
export class SaraAiController {
    constructor(private readonly saraAiService: SaraAiService) { }

    /**
     * GET /sara-ai/chats
     * Get all unique chat sessions with message counts
     */
    @Get('chats')
    async getAllSessions() {
        return this.saraAiService.getAllSessions();
    }

    /**
     * GET /sara-ai/chats/:phoneNumber
     * Get all messages for a specific phone number
     */
    @Get('chats/:phoneNumber')
    async getConversation(@Param('phoneNumber') phoneNumber: string) {
        return this.saraAiService.getConversation(phoneNumber);
    }

    /**
     * GET /sara-ai/stats
     * Get database statistics
     */
    @Get('stats')
    async getStats() {
        return this.saraAiService.getStats();
    }
}
