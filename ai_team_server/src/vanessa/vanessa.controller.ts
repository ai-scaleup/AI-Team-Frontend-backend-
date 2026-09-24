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
import { VanessaService } from './vanessa.service';
import { Prisma } from 'src/generated/prisma/client';

const vanessaChatLogSchema = {
  type: 'object',
  required: ['sessionId', 'sender', 'messageText'],
  properties: {
    sessionId: { type: 'string', example: 'session_123' },
    sender: { type: 'string', example: 'user' },
    messageText: { type: 'string', example: 'Hello' },
  },
};

const vanessaLeadSchema = {
  type: 'object',
  required: ['sessionId', 'name', 'email', 'phone'],
  properties: {
    sessionId: { type: 'string', example: 'session_123' },
    name: { type: 'string', example: 'Jane Doe' },
    email: { type: 'string', format: 'email', example: 'jane@example.com' },
    phone: { type: 'string', example: '+15551234567' },
  },
};

const vanessaLeadUpdateSchema = {
  type: 'object',
  properties: vanessaLeadSchema.properties,
};

// This group carries no authentication: neither the development token nor a
// Clerk JWT is checked, and auth/public-routes.ts keeps AuthMiddleware off the
// /vanessa prefix. Anyone who knows the URL can read and write the
// chat logs and leads, so this is a temporary state to be reverted once the
// dashboard sends a credential again.
//
// The group was called /chiara-vanessa before; that path stays as an alias so
// callers still posting to the old URL keep working.
@ApiTags('vanessa')
@Controller(['vanessa', 'chiara-vanessa'])
export class VanessaController {
  constructor(private readonly vanessaService: VanessaService) {}

  @Post('chat-logs')
  @ApiOperation({ summary: 'Create a Vanessa chat log' })
  @ApiBody({ schema: vanessaChatLogSchema })
  @ApiCreatedResponse({ description: 'Chat log created' })
  async createChatLog(@Body() data: Prisma.VanessaChatLogCreateInput) {
    return this.vanessaService.createChatLog(data);
  }

  @Get('chat-logs/sessions')
  @ApiOperation({ summary: 'List Vanessa chat sessions' })
  @ApiOkResponse({ description: 'Sessions returned' })
  async getAllSessions() {
    return this.vanessaService.getAllSessions();
  }

  @Get('chat-logs/:sessionId')
  @ApiOperation({ summary: 'Get Vanessa chat logs by session' })
  @ApiParam({ name: 'sessionId', example: 'session_123' })
  @ApiOkResponse({ description: 'Chat logs returned' })
  async getChatLogs(@Param('sessionId') sessionId: string) {
    return this.vanessaService.getChatLogsBySessionId(sessionId);
  }

  @Post('leads')
  @ApiOperation({
    summary: 'Create a Vanessa lead',
    description:
      'A session may hold many leads, so repeat submissions for the same sessionId each create a new row.',
  })
  @ApiBody({ schema: vanessaLeadSchema })
  @ApiCreatedResponse({ description: 'Lead created' })
  async createLead(@Body() data: Prisma.VanessaLeadCreateInput) {
    return this.vanessaService.createLead(data);
  }

  @Get('leads')
  @ApiOperation({ summary: 'List every Vanessa lead' })
  @ApiOkResponse({ description: 'Leads returned' })
  async getAllLeads() {
    return this.vanessaService.getAllLeads();
  }

  @Get('leads/session/:sessionId')
  @ApiOperation({ summary: 'List the Vanessa leads of one session' })
  @ApiParam({ name: 'sessionId', example: 'session_123' })
  @ApiOkResponse({ description: 'Leads returned, newest first' })
  async getLeadsBySessionId(@Param('sessionId') sessionId: string) {
    return this.vanessaService.getLeadsBySessionId(sessionId);
  }

  @Get('leads/:id')
  @ApiOperation({ summary: 'Get one Vanessa lead by id' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Lead returned' })
  @ApiNotFoundResponse({ description: 'No lead with this id' })
  async getLeadById(@Param('id', ParseIntPipe) id: number) {
    return this.vanessaService.getLeadById(id);
  }

  @Put('leads/:id')
  @ApiOperation({ summary: 'Replace a Vanessa lead' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ schema: vanessaLeadSchema })
  @ApiOkResponse({ description: 'Lead updated' })
  @ApiNotFoundResponse({ description: 'No lead with this id' })
  async replaceLead(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Prisma.VanessaLeadUpdateInput,
  ) {
    return this.vanessaService.updateLead(id, data);
  }

  @Patch('leads/:id')
  @ApiOperation({ summary: 'Update part of a Vanessa lead' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ schema: vanessaLeadUpdateSchema })
  @ApiOkResponse({ description: 'Lead updated' })
  @ApiNotFoundResponse({ description: 'No lead with this id' })
  async updateLead(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Prisma.VanessaLeadUpdateInput,
  ) {
    return this.vanessaService.updateLead(id, data);
  }

  @Delete('leads/:id')
  @ApiOperation({ summary: 'Delete a Vanessa lead' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Lead deleted' })
  @ApiNotFoundResponse({ description: 'No lead with this id' })
  async deleteLead(@Param('id', ParseIntPipe) id: number) {
    return this.vanessaService.deleteLead(id);
  }
}
