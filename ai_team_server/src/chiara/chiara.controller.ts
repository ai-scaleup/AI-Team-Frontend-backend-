import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ChiaraService } from './chiara.service';
import { Prisma } from 'src/generated/prisma/client';

const chiaraChatLogSchema = {
  type: 'object',
  required: ['sessionId', 'sender', 'messageText'],
  properties: {
    sessionId: { type: 'string', example: 'session_123' },
    sender: { type: 'string', example: 'user' },
    messageText: { type: 'string', example: 'Hello' },
  },
};

const chiaraLeadSchema = {
  type: 'object',
  required: ['sessionId', 'name', 'email', 'phone'],
  properties: {
    sessionId: { type: 'string', example: 'session_123' },
    name: { type: 'string', example: 'Jane Doe' },
    email: { type: 'string', format: 'email', example: 'jane@example.com' },
    phone: { type: 'string', example: '+15551234567' },
  },
};

@ApiTags('chiara')
@Controller('chiara')
export class ChiaraController {
  constructor(private readonly chiaraService: ChiaraService) {}

  @Post('chat-logs')
  @ApiOperation({ summary: 'Create a Chiara inbound chat log' })
  @ApiBody({ schema: chiaraChatLogSchema })
  @ApiCreatedResponse({ description: 'Chat log created' })
  async createChatLog(@Body() data: Prisma.ChiaraInboundChatLogCreateInput) {
    return this.chiaraService.createChatLog(data);
  }

  @Get('chat-logs/sessions')
  @ApiOperation({ summary: 'List Chiara chat sessions' })
  @ApiOkResponse({ description: 'Sessions returned' })
  async getAllSessions() {
    return this.chiaraService.getAllSessions();
  }

  @Get('chat-logs/:sessionId')
  @ApiOperation({ summary: 'Get Chiara chat logs by session' })
  @ApiParam({ name: 'sessionId', example: 'session_123' })
  @ApiOkResponse({ description: 'Chat logs returned' })
  async getChatLogs(@Param('sessionId') sessionId: string) {
    return this.chiaraService.getChatLogsBySessionId(sessionId);
  }

  @Post('leads')
  @ApiOperation({ summary: 'Create a Chiara lead' })
  @ApiBody({ schema: chiaraLeadSchema })
  @ApiCreatedResponse({ description: 'Lead created' })
  @ApiConflictResponse({
    description: 'A lead already exists for this sessionId',
  })
  async createLead(@Body() data: Prisma.ChiaraLeadCreateInput) {
    return this.chiaraService.createLead(data);
  }

  @Get('leads')
  @ApiOperation({ summary: 'List Chiara leads' })
  @ApiOkResponse({ description: 'Leads returned' })
  async getAllLeads() {
    return this.chiaraService.getAllLeads();
  }

  @Get('leads/:sessionId')
  @ApiOperation({ summary: 'Get Chiara lead by session' })
  @ApiParam({ name: 'sessionId', example: 'session_123' })
  @ApiOkResponse({ description: 'Lead returned' })
  async getLead(@Param('sessionId') sessionId: string) {
    return this.chiaraService.getLeadBySessionId(sessionId);
  }
}
