import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FreapChiaraService } from './freap-chiara.service';
import { Prisma } from 'src/generated/prisma/client';

const freapChiaraChatLogSchema = {
  type: 'object',
  required: ['sessionId', 'sender', 'messageText'],
  properties: {
    sessionId: { type: 'string', example: 'session_123' },
    sender: { type: 'string', example: 'user' },
    messageText: { type: 'string', example: 'Hello' },
  },
};

@ApiTags('freap-chiara')
@Controller('freap-chiara')
export class FreapChiaraController {
  constructor(private readonly freapChiaraService: FreapChiaraService) {}

  @Post('chat-logs')
  @ApiOperation({ summary: 'Create a Freap Chiara inbound chat log' })
  @ApiBody({ schema: freapChiaraChatLogSchema })
  @ApiCreatedResponse({ description: 'Chat log created' })
  async createChatLog(
    @Body() data: Prisma.FreapChiaraInboundChatLogCreateInput,
  ) {
    return this.freapChiaraService.createChatLog(data);
  }

  @Get('chat-logs/sessions')
  @ApiOperation({ summary: 'List Freap Chiara chat sessions' })
  @ApiOkResponse({ description: 'Sessions returned' })
  async getAllSessions() {
    return this.freapChiaraService.getAllSessions();
  }

  @Get('chat-logs/:sessionId')
  @ApiOperation({ summary: 'Get Freap Chiara chat logs by session' })
  @ApiParam({ name: 'sessionId', example: 'session_123' })
  @ApiOkResponse({ description: 'Chat logs returned' })
  async getChatLogs(@Param('sessionId') sessionId: string) {
    return this.freapChiaraService.getChatLogsBySessionId(sessionId);
  }
}
