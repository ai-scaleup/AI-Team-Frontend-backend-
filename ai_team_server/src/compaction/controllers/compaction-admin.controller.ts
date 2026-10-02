import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiModel,
  CompactionEventStatus,
  CompactionOwnerType,
  CompactionSummaryStyle,
} from 'src/generated/prisma/client';
import {
  CreateCompactionOverrideDto,
  UpdateCompactionSettingsDto,
} from '../dto/compaction.dto';
import { CompactionSettingsService } from '../services/compaction-settings.service';
import { CompactionService } from '../services/compaction.service';

const SETTINGS_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    ownerType: { enum: Object.values(CompactionOwnerType), example: 'GLOBAL' },
    ownerId: {
      type: 'string',
      example: '',
      description:
        'MembershipTemplate.id, AgentTeam.id or an AgentName. Empty for the global row.',
    },
    enabled: { type: 'boolean', example: true },
    watermarkPercent: { type: 'integer', example: 75 },
    keepLastTurns: { type: 'integer', example: 8 },
    memoryCapTokens: { type: 'integer', example: 1200 },
    conversationBudget: { type: 'integer', example: 24000 },
    summaryStyle: {
      enum: Object.values(CompactionSummaryStyle),
      example: 'STRUCTURED',
    },
    apiModel: { enum: Object.values(ApiModel), example: 'GPT_4O_MINI' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const EVENT_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    sessionId: { type: 'string' },
    chatId: { type: 'string' },
    agentName: { type: 'string', example: 'TONY' },
    email: { type: 'string', nullable: true },
    title: { type: 'string', nullable: true },
    tokensBefore: { type: 'integer', example: 18400 },
    tokensAfter: { type: 'integer', example: 6120 },
    turnsCompacted: { type: 'integer', example: 14 },
    summaryTokens: { type: 'integer', example: 980 },
    costTokens: { type: 'integer', example: 1450 },
    status: { enum: Object.values(CompactionEventStatus), example: 'OK' },
    apiModel: { enum: Object.values(ApiModel), nullable: true },
    detail: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
  },
} as const;

@ApiTags('compaction-admin')
@Controller('admin/compaction')
export class CompactionAdminController {
  constructor(
    private readonly settingsService: CompactionSettingsService,
    private readonly compactionService: CompactionService,
  ) {}

  @Get('settings')
  @ApiOperation({
    summary: 'Get the global compaction defaults',
    description:
      'The row every package falls back to. Created with defaults on first read, so this never 404s.',
  })
  @ApiOkResponse({ description: 'Settings returned', schema: SETTINGS_SCHEMA })
  getSettings() {
    return this.settingsService.getGlobalSettings();
  }

  @Patch('settings')
  @ApiOperation({
    summary: 'Update the global compaction defaults',
    description:
      'Writes only the fields present in the body. Touches the global settings row and nothing else.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        watermarkPercent: { type: 'integer', minimum: 30, maximum: 95 },
        keepLastTurns: { type: 'integer', minimum: 2, maximum: 40 },
        memoryCapTokens: { type: 'integer', minimum: 200, maximum: 20000 },
        conversationBudget: {
          type: 'integer',
          example: 24000,
          description: '0 inherits the platform conversation limit.',
        },
        summaryStyle: { enum: Object.values(CompactionSummaryStyle) },
        apiModel: { type: 'string', example: 'GPT_4O_MINI' },
      },
      example: { watermarkPercent: 80, keepLastTurns: 6 },
    },
  })
  @ApiOkResponse({ description: 'Settings updated', schema: SETTINGS_SCHEMA })
  @ApiBadRequestResponse({ description: 'Invalid field value' })
  updateSettings(@Body() body: UpdateCompactionSettingsDto) {
    return this.settingsService.updateGlobalSettings(body);
  }

  @Get('api-models')
  @ApiOperation({
    summary: 'List the models a summary can be written with',
    description:
      'Options for the model dropdown, with isDefault marking the one a settings row falls back to. OpenAI only for now; other providers are appended here later.',
  })
  @ApiOkResponse({
    description: 'Models returned',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: { enum: Object.values(ApiModel) },
          label: { type: 'string', example: 'GPT-4o mini' },
          modelId: { type: 'string', example: 'gpt-4o-mini' },
          provider: { type: 'string', example: 'openai' },
          isDefault: { type: 'boolean', example: true },
        },
      },
    },
  })
  listApiModels() {
    return this.settingsService.listApiModels();
  }

  @Get('overrides')
  @ApiOperation({
    summary: 'List the per-package compaction overrides',
    description:
      'Every membership, team or agent given its own settings. Packages not listed here follow the global defaults.',
  })
  @ApiOkResponse({
    description: 'Overrides returned',
    schema: { type: 'array', items: SETTINGS_SCHEMA },
  })
  listOverrides() {
    return this.settingsService.listOverrides();
  }

  @Get('overrides/options')
  @ApiOperation({
    summary: 'List the packages an override can be attached to',
    description: 'Memberships, active teams and the agent catalogue.',
  })
  @ApiOkResponse({ description: 'Options returned' })
  listOwnerOptions() {
    return this.settingsService.listOwnerOptions();
  }

  @Post('overrides')
  @ApiOperation({
    summary: 'Give a package its own compaction settings',
    description:
      'Starts as a copy of the global defaults, so only the fields that should differ need sending.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['ownerType', 'ownerId'],
      properties: {
        ownerType: {
          enum: ['MEMBERSHIP', 'TEAM', 'AGENT'],
          example: 'TEAM',
        },
        ownerId: {
          type: 'string',
          description: 'MembershipTemplate.id, AgentTeam.id or an AgentName.',
        },
        enabled: { type: 'boolean' },
        watermarkPercent: { type: 'integer' },
        keepLastTurns: { type: 'integer' },
        memoryCapTokens: { type: 'integer' },
      },
    },
  })
  @ApiOkResponse({ description: 'Override created', schema: SETTINGS_SCHEMA })
  @ApiBadRequestResponse({ description: 'Invalid ownerType or field value' })
  @ApiNotFoundResponse({ description: 'The package does not exist' })
  @ApiConflictResponse({ description: 'This package already has an override' })
  createOverride(@Body() body: CreateCompactionOverrideDto) {
    return this.settingsService.createOverride(body);
  }

  @Patch('overrides/:id')
  @ApiOperation({ summary: 'Update one per-package override' })
  @ApiParam({ name: 'id', description: 'Override id' })
  @ApiOkResponse({ description: 'Override updated', schema: SETTINGS_SCHEMA })
  @ApiBadRequestResponse({ description: 'Invalid field value' })
  @ApiNotFoundResponse({ description: 'Override not found' })
  updateOverride(
    @Param('id') id: string,
    @Body() body: UpdateCompactionSettingsDto,
  ) {
    return this.settingsService.updateOverride(id, body);
  }

  @Delete('overrides/:id')
  @ApiOperation({
    summary: 'Remove a per-package override',
    description:
      'The package goes back to following the global defaults. Removes one settings row; no chat data is touched.',
  })
  @ApiParam({ name: 'id', description: 'Override id' })
  @ApiOkResponse({ description: 'Override deleted' })
  @ApiNotFoundResponse({ description: 'Override not found' })
  deleteOverride(@Param('id') id: string) {
    return this.settingsService.deleteOverride(id);
  }

  @Get('events')
  @ApiOperation({
    summary: 'List recent compactions',
    description:
      'Newest first, including the attempts that fell back to plain truncation.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 25 })
  @ApiOkResponse({
    description: 'Events returned',
    schema: { type: 'array', items: EVENT_SCHEMA },
  })
  listEvents(@Query('limit') limit?: string) {
    return this.compactionService.listEvents(limit);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Compaction totals for the last 24 hours',
    description:
      'Headline numbers for the panel: how many ran and what they saved.',
  })
  @ApiOkResponse({ description: 'Stats returned' })
  getStats() {
    return this.compactionService.getStats();
  }
}
