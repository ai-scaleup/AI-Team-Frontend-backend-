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
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ChiaraWhatsappService } from './chiara-whatsapp.service';
import { Prisma } from 'src/generated/prisma/client';

const chiaraWhatsappLeadSchema = {
  type: 'object',
  required: ['sessionId', 'name', 'email', 'phone'],
  properties: {
    sessionId: { type: 'string', example: 'session_123' },
    name: { type: 'string', example: 'Jane Doe' },
    email: { type: 'string', format: 'email', example: 'jane@example.com' },
    phone: { type: 'string', example: '+15551234567' },
  },
};

const chiaraWhatsappLeadUpdateSchema = {
  type: 'object',
  properties: chiaraWhatsappLeadSchema.properties,
};

// The development token (DEV_API_TOKEN) is the only credential this group
// accepts — DevTokenMiddleware checks it, and no Clerk JWT is honoured here.
@ApiTags('chiara-whatsapp')
@ApiSecurity('dev-token')
@ApiUnauthorizedResponse({
  description:
    'Missing or wrong development token. Send it as x-dev-token, or as Authorization: Bearer <token>.',
})
@Controller('chiara-whatsapp')
export class ChiaraWhatsappController {
  constructor(private readonly chiaraWhatsappService: ChiaraWhatsappService) {}

  @Post('leads')
  @ApiOperation({
    summary: 'Create a Chiara WhatsApp lead',
    description:
      'A session may hold many leads, so repeat submissions for the same sessionId each create a new row.',
  })
  @ApiBody({ schema: chiaraWhatsappLeadSchema })
  @ApiCreatedResponse({ description: 'Lead created' })
  async createLead(@Body() data: Prisma.ChiaraWhatsappLeadCreateInput) {
    return this.chiaraWhatsappService.createLead(data);
  }

  @Get('leads')
  @ApiOperation({ summary: 'List every Chiara WhatsApp lead' })
  @ApiOkResponse({ description: 'Leads returned' })
  async getAllLeads() {
    return this.chiaraWhatsappService.getAllLeads();
  }

  @Get('leads/session/:sessionId')
  @ApiOperation({ summary: 'List the Chiara WhatsApp leads of one session' })
  @ApiParam({ name: 'sessionId', example: 'session_123' })
  @ApiOkResponse({ description: 'Leads returned, newest first' })
  async getLeadsBySessionId(@Param('sessionId') sessionId: string) {
    return this.chiaraWhatsappService.getLeadsBySessionId(sessionId);
  }

  @Get('leads/:id')
  @ApiOperation({ summary: 'Get one Chiara WhatsApp lead by id' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Lead returned' })
  @ApiNotFoundResponse({ description: 'No lead with this id' })
  async getLeadById(@Param('id', ParseIntPipe) id: number) {
    return this.chiaraWhatsappService.getLeadById(id);
  }

  @Put('leads/:id')
  @ApiOperation({ summary: 'Replace a Chiara WhatsApp lead' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ schema: chiaraWhatsappLeadSchema })
  @ApiOkResponse({ description: 'Lead updated' })
  @ApiNotFoundResponse({ description: 'No lead with this id' })
  async replaceLead(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Prisma.ChiaraWhatsappLeadUpdateInput,
  ) {
    return this.chiaraWhatsappService.updateLead(id, data);
  }

  @Patch('leads/:id')
  @ApiOperation({ summary: 'Update part of a Chiara WhatsApp lead' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ schema: chiaraWhatsappLeadUpdateSchema })
  @ApiOkResponse({ description: 'Lead updated' })
  @ApiNotFoundResponse({ description: 'No lead with this id' })
  async updateLead(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Prisma.ChiaraWhatsappLeadUpdateInput,
  ) {
    return this.chiaraWhatsappService.updateLead(id, data);
  }

  @Delete('leads/:id')
  @ApiOperation({ summary: 'Delete a Chiara WhatsApp lead' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Lead deleted' })
  @ApiNotFoundResponse({ description: 'No lead with this id' })
  async deleteLead(@Param('id', ParseIntPipe) id: number) {
    return this.chiaraWhatsappService.deleteLead(id);
  }
}
