import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FreapJenniferService } from './freap-jennifer.service';
import { Prisma } from 'src/generated/prisma/client';

const freapJenniferChatLogSchema = {
  type: 'object',
  required: ['sessionId', 'sender', 'messageText'],
  properties: {
    sessionId: { type: 'string', example: 'session_123' },
    sender: { type: 'string', example: 'user' },
    messageText: { type: 'string', example: 'Hello' },
  },
};

@ApiTags('freap-jennifer')
@Controller('freap-jennifer')
export class FreapJenniferController {
  constructor(private readonly freapJenniferService: FreapJenniferService) {}

  @Post('chat-logs')
  @ApiOperation({ summary: 'Create a Freap Jennifer chat log' })
  @ApiBody({ schema: freapJenniferChatLogSchema })
  @ApiCreatedResponse({ description: 'Chat log created' })
  async createChatLog(@Body() data: Prisma.FreapJenniferChatLogCreateInput) {
    return this.freapJenniferService.createChatLog(data);
  }

  @Get('chat-logs/sessions')
  @ApiOperation({ summary: 'List Freap Jennifer chat sessions' })
  @ApiOkResponse({ description: 'Sessions returned' })
  async getAllSessions() {
    return this.freapJenniferService.getAllSessions();
  }

  @Get('chat-logs/:sessionId')
  @ApiOperation({ summary: 'Get Freap Jennifer chat logs by session' })
  @ApiParam({ name: 'sessionId', example: 'session_123' })
  @ApiOkResponse({ description: 'Chat logs returned' })
  async getChatLogs(@Param('sessionId') sessionId: string) {
    return this.freapJenniferService.getChatLogsBySessionId(sessionId);
  }
}
