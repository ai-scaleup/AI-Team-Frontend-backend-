import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ChiaraVanessaService } from './chiara-vanessa.service';
import { Prisma } from 'src/generated/prisma/client';

const chiaraVanessaChatLogSchema = {
  type: 'object',
  required: ['sessionId', 'sender', 'messageText'],
  properties: {
    sessionId: { type: 'string', example: 'session_123' },
    sender: { type: 'string', example: 'user' },
    messageText: { type: 'string', example: 'Hello' },
  },
};

const chiaraVanessaLeadSchema = {
  type: 'object',
  required: ['sessionId', 'name', 'email', 'phone'],
  properties: {
    sessionId: { type: 'string', example: 'session_123' },
    name: { type: 'string', example: 'Jane Doe' },
    email: { type: 'string', format: 'email', example: 'jane@example.com' },
    phone: { type: 'string', example: '+15551234567' },
  },
};

const chiaraVanessaLeadUpdateSchema = {
  type: 'object',
  properties: chiaraVanessaLeadSchema.properties,
};

// This group carries no authentication: neither the development token nor a
// Clerk JWT is checked, and auth/public-routes.ts keeps AuthMiddleware off the
// /chiara-vanessa prefix. Anyone who knows the URL can read and write the
// chat logs and leads, so this is a temporary state to be reverted once the
// dashboard sends a credential again.
@ApiTags('chiara-vanessa')
@Controller('chiara-vanessa')
export class ChiaraVanessaController {
  constructor(private readonly chiaraVanessaService: ChiaraVanessaService) {}

  @Post('chat-logs')
  @ApiOperation({ summary: 'Create a Chiara Vanessa chat log' })
  @ApiBody({ schema: chiaraVanessaChatLogSchema })
  @ApiCreatedResponse({ description: 'Chat log created' })
  async createChatLog(@Body() data: Prisma.ChiaraVanessaChatLogCreateInput) {
    return this.chiaraVanessaService.createChatLog(data);
  }

  @Get('chat-logs/sessions')
  @ApiOperation({ summary: 'List Chiara Vanessa chat sessions' })
  @ApiOkResponse({ description: 'Sessions returned' })
  async getAllSessions() {
    return this.chiaraVanessaService.getAllSessions();
  }

  @Get('chat-logs/:sessionId')
  @ApiOperation({ summary: 'Get Chiara Vanessa chat logs by session' })
  @ApiParam({ name: 'sessionId', example: 'session_123' })
  @ApiOkResponse({ description: 'Chat logs returned' })
  async getChatLogs(@Param('sessionId') sessionId: string) {
    return this.chiaraVanessaService.getChatLogsBySessionId(sessionId);
  }

  @Post('leads')
  @ApiOperation({
    summary: 'Create a Chiara Vanessa lead',
    description:
      'A session may hold many leads, so repeat submissions for the same sessionId each create a new row.',
  })
  @ApiBody({ schema: chiaraVanessaLeadSchema })
  @ApiCreatedResponse({ description: 'Lead created' })
  async createLead(@Body() data: Prisma.ChiaraVanessaLeadCreateInput) {
    return this.chiaraVanessaService.createLead(data);
  }

  @Get('leads')
  @ApiOperation({ summary: 'List every Chiara Vanessa lead' })
  @ApiOkResponse({ description: 'Leads returned' })
  async getAllLeads() {
    return this.chiaraVanessaService.getAllLeads();
  }

  @Get('leads/session/:sessionId')
  @ApiOperation({ summary: 'List the Chiara Vanessa leads of one session' })
  @ApiParam({ name: 'sessionId', example: 'session_123' })
  @ApiOkResponse({ description: 'Leads returned, newest first' })
  async getLeadsBySessionId(@Param('sessionId') sessionId: string) {
    return this.chiaraVanessaService.getLeadsBySessionId(sessionId);
  }

  @Get('leads/:id')
  @ApiOperation({ summary: 'Get one Chiara Vanessa lead by id' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Lead returned' })
  @ApiNotFoundResponse({ description: 'No lead with this id' })
  async getLeadById(@Param('id', ParseIntPipe) id: number) {
    return this.chiaraVanessaService.getLeadById(id);
  }

  @Put('leads/:id')
  @ApiOperation({ summary: 'Replace a Chiara Vanessa lead' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ schema: chiaraVanessaLeadSchema })
  @ApiOkResponse({ description: 'Lead updated' })
  @ApiNotFoundResponse({ description: 'No lead with this id' })
  async replaceLead(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Prisma.ChiaraVanessaLeadUpdateInput,
  ) {
    return this.chiaraVanessaService.updateLead(id, data);
  }

  @Patch('leads/:id')
  @ApiOperation({ summary: 'Update part of a Chiara Vanessa lead' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ schema: chiaraVanessaLeadUpdateSchema })
  @ApiOkResponse({ description: 'Lead updated' })
  @ApiNotFoundResponse({ description: 'No lead with this id' })
  async updateLead(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Prisma.ChiaraVanessaLeadUpdateInput,
  ) {
    return this.chiaraVanessaService.updateLead(id, data);
  }

  @Delete('leads/:id')
  @ApiOperation({ summary: 'Delete a Chiara Vanessa lead' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Lead deleted' })
  @ApiNotFoundResponse({ description: 'No lead with this id' })
  async deleteLead(@Param('id', ParseIntPipe) id: number) {
    return this.chiaraVanessaService.deleteLead(id);
  }
}
