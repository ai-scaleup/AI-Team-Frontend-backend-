import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SaraAiService } from '../services/sara-ai.service';

@ApiTags('sara-ai')
@Controller('sara-ai')
export class SaraAiController {
  constructor(private readonly saraAiService: SaraAiService) {}

  /**
   * GET /sara-ai/chats
   * Get all unique chat sessions with message counts
   */
  @Get('chats')
  @ApiOperation({ summary: 'List Sara AI chat sessions' })
  @ApiOkResponse({ description: 'Sessions returned' })
  async getAllSessions() {
    return this.saraAiService.getAllSessions();
  }

  /**
   * GET /sara-ai/chats/:phoneNumber
   * Get all messages for a specific phone number
   */
  @Get('chats/:phoneNumber')
  @ApiOperation({ summary: 'Get Sara AI conversation by phone number' })
  @ApiParam({ name: 'phoneNumber', example: '+15551234567' })
  @ApiOkResponse({ description: 'Conversation returned' })
  async getConversation(@Param('phoneNumber') phoneNumber: string) {
    return this.saraAiService.getConversation(phoneNumber);
  }

  /**
   * GET /sara-ai/analytics?days=30
   * Get daily aggregated analytics from metis_chat_logs
   */
  @Get('analytics')
  @ApiOperation({ summary: 'Get Sara AI analytics' })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  @ApiOkResponse({ description: 'Analytics returned' })
  async getAnalytics(@Query('days') days?: string) {
    const numDays = days ? parseInt(days, 10) : 30;
    return this.saraAiService.getAnalytics(numDays);
  }

  /**
   * GET /sara-ai/stats
   * Get database statistics
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get Sara AI database stats' })
  @ApiOkResponse({ description: 'Stats returned' })
  async getStats() {
    return this.saraAiService.getStats();
  }
}
