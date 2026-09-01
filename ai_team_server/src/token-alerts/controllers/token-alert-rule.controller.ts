import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
  TokenAlertLevel,
  TokenAlertScope,
} from 'src/generated/prisma/client';
import { API_MODEL_CATALOG } from '../constants/api-models';
import {
  CreateTokenAlertRuleDto,
  SyncTokenAlertRulesDto,
  UpdateTokenAlertRuleDto,
  UpdateTokenAlertSettingsDto,
} from '../dto/token-alert-rule.dto';
import { TokenAlertRuleService } from '../services/token-alert-rule.service';

const RULE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    scope: { enum: Object.values(TokenAlertScope), example: 'CONVERSATION' },
    thresholdPercent: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      example: 75,
    },
    level: { enum: Object.values(TokenAlertLevel), example: 'WARNING' },
    message: {
      type: 'string',
      example: "75% of conversation tokens used. You're approaching the limit.",
    },
    isActive: { type: 'boolean', example: true },
    sortOrder: { type: 'integer', example: 2 },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const SETTINGS_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    scope: { enum: Object.values(TokenAlertScope), example: 'CONVERSATION' },
    tokenLimit: {
      type: 'integer',
      minimum: 0,
      example: 120000,
      description:
        'Token allowance the threshold percentages are measured against. 0 means unset.',
    },
    apiModel: { enum: Object.values(ApiModel), example: 'GPT_4O_MINI' },
    apiModelId: {
      type: 'string',
      example: 'gpt-4o-mini',
      description: 'The id passed to the provider API.',
    },
    apiModelLabel: { type: 'string', example: 'GPT-4o mini' },
    apiProvider: { type: 'string', example: 'openai' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

@ApiTags('token-alert-rules')
@Controller('admin/token-alert-rules')
export class TokenAlertRuleController {
  constructor(private readonly tokenAlertRuleService: TokenAlertRuleService) {}

  @Get()
  @ApiOperation({
    summary: 'List token usage alert rules',
    description:
      'Returns the configured announcer-bar alert rules, ordered by sortOrder then thresholdPercent.',
  })
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: TokenAlertScope,
    description: 'Filter by alert scope. Omit to return every scope.',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active flag.',
  })
  @ApiOkResponse({
    description: 'Alert rules returned',
    schema: { type: 'array', items: RULE_SCHEMA },
  })
  @ApiBadRequestResponse({ description: 'Invalid scope or isActive value' })
  listRules(
    @Query('scope') scope?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.tokenAlertRuleService.listRules(scope, isActive);
  }

  // Declared before @Get(':id') so the literal paths are not captured by it.
  @Get('settings')
  @ApiOperation({
    summary: 'Get the panel token limit and API model',
    description:
      'Returns the token allowance and the model configured for one scope. The row is created with defaults on first read, so this never 404s.',
  })
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: TokenAlertScope,
    description: 'Defaults to CONVERSATION.',
  })
  @ApiOkResponse({ description: 'Settings returned', schema: SETTINGS_SCHEMA })
  @ApiBadRequestResponse({ description: 'Invalid scope' })
  getSettings(@Query('scope') scope?: string) {
    return this.tokenAlertRuleService.getSettings(scope);
  }

  @Get('settings/all')
  @ApiOperation({ summary: 'Get the settings for every scope' })
  @ApiOkResponse({
    description: 'Settings returned',
    schema: { type: 'array', items: SETTINGS_SCHEMA },
  })
  listSettings() {
    return this.tokenAlertRuleService.listSettings();
  }

  @Get('api-models')
  @ApiOperation({
    summary: 'List the selectable API models',
    description:
      'Options for the model dropdown. OpenAI models only for now; other providers are appended here later.',
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
        },
      },
      example: API_MODEL_CATALOG,
    },
  })
  listApiModels() {
    return this.tokenAlertRuleService.listApiModels();
  }

  @Patch('settings')
  @ApiOperation({
    summary: 'Update the panel token limit and/or API model',
    description:
      'Writes only the fields present in the body; anything omitted keeps its stored value. Touches the settings row for this scope and nothing else.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        scope: {
          enum: Object.values(TokenAlertScope),
          default: 'CONVERSATION',
        },
        tokenLimit: { type: 'integer', minimum: 0, example: 120000 },
        apiModel: {
          type: 'string',
          enum: Object.values(ApiModel),
          example: 'GPT_4O_MINI',
          description:
            'Enum value (GPT_4O_MINI) or provider model id (gpt-4o-mini).',
        },
      },
    },
    examples: {
      both: {
        summary: 'Set the limit and the model',
        value: {
          scope: 'CONVERSATION',
          tokenLimit: 120000,
          apiModel: 'GPT_4O_MINI',
        },
      },
      limitOnly: {
        summary: 'Set only the limit',
        value: { tokenLimit: 200000 },
      },
    },
  })
  @ApiOkResponse({ description: 'Settings updated', schema: SETTINGS_SCHEMA })
  @ApiBadRequestResponse({
    description: 'Invalid scope, tokenLimit, or apiModel',
  })
  updateSettings(@Body() body: UpdateTokenAlertSettingsDto) {
    return this.tokenAlertRuleService.updateSettings(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a token usage alert rule by id' })
  @ApiParam({ name: 'id', description: 'Alert rule id' })
  @ApiOkResponse({ description: 'Alert rule returned', schema: RULE_SCHEMA })
  @ApiNotFoundResponse({ description: 'Alert rule not found' })
  getRule(@Param('id') id: string) {
    return this.tokenAlertRuleService.getRule(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a token usage alert rule' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['thresholdPercent', 'level', 'message'],
      properties: {
        scope: {
          enum: Object.values(TokenAlertScope),
          default: 'CONVERSATION',
        },
        thresholdPercent: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          example: 80,
        },
        level: { enum: Object.values(TokenAlertLevel), example: 'WARNING' },
        message: {
          type: 'string',
          example: "You're approaching the conversation token limit.",
        },
        isActive: { type: 'boolean', default: true },
        sortOrder: {
          type: 'integer',
          example: 4,
          description: 'Defaults to thresholdPercent when omitted.',
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Alert rule created', schema: RULE_SCHEMA })
  @ApiBadRequestResponse({ description: 'Invalid threshold, level, or message' })
  @ApiConflictResponse({
    description: 'A rule already exists for this scope and threshold',
  })
  createRule(@Body() body: CreateTokenAlertRuleDto) {
    return this.tokenAlertRuleService.createRule(body);
  }

  @Put()
  @ApiOperation({
    summary: 'Bulk save the alert rules for one scope',
    description:
      'Backs the admin panel "Save Alerts" button. Rules with an id are updated, rules without one are created, and rules of this scope missing from the payload are deleted. Runs in a single transaction and touches no other table.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['rules'],
      properties: {
        scope: {
          enum: Object.values(TokenAlertScope),
          default: 'CONVERSATION',
        },
        tokenLimit: {
          type: 'integer',
          minimum: 0,
          example: 120000,
          description:
            'Optional. Saves the panel token limit in the same call. Omit to leave it unchanged.',
        },
        apiModel: {
          type: 'string',
          enum: Object.values(ApiModel),
          example: 'GPT_4O_MINI',
          description:
            'Optional. Saves the panel API model in the same call. Omit to leave it unchanged.',
        },
        rules: {
          type: 'array',
          items: {
            type: 'object',
            required: ['thresholdPercent', 'level', 'message'],
            properties: {
              id: {
                type: 'string',
                description: 'Omit to create a new rule.',
              },
              thresholdPercent: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
              },
              level: { enum: Object.values(TokenAlertLevel) },
              message: { type: 'string' },
              isActive: { type: 'boolean', default: true },
              sortOrder: {
                type: 'integer',
                description: 'Defaults to the array position when omitted.',
              },
            },
          },
        },
      },
      example: {
        scope: 'CONVERSATION',
        tokenLimit: 120000,
        apiModel: 'GPT_4O_MINI',
        rules: [
          {
            id: 'token-alert-conversation-50',
            thresholdPercent: 50,
            level: 'INFO',
            message:
              "You've used 50% of your conversation tokens. Consider wrapping up soon.",
            isActive: true,
          },
          {
            thresholdPercent: 95,
            level: 'CRITICAL',
            message: 'Conversation almost full. Start a new one.',
            isActive: true,
          },
        ],
      },
    },
  })
  @ApiOkResponse({
    description: 'Alert rules saved',
    schema: {
      type: 'object',
      properties: {
        scope: { enum: Object.values(TokenAlertScope) },
        created: { type: 'integer', example: 1 },
        updated: { type: 'integer', example: 3 },
        deleted: { type: 'integer', example: 0 },
        settings: SETTINGS_SCHEMA,
        rules: { type: 'array', items: RULE_SCHEMA },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid payload' })
  @ApiNotFoundResponse({ description: 'A supplied rule id is not in this scope' })
  @ApiConflictResponse({ description: 'Two rules share the same threshold' })
  syncRules(@Body() body: SyncTokenAlertRulesDto) {
    return this.tokenAlertRuleService.syncRules(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a token usage alert rule' })
  @ApiParam({ name: 'id', description: 'Alert rule id' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        scope: { enum: Object.values(TokenAlertScope) },
        thresholdPercent: { type: 'integer', minimum: 1, maximum: 100 },
        level: { enum: Object.values(TokenAlertLevel) },
        message: { type: 'string' },
        isActive: { type: 'boolean' },
        sortOrder: { type: 'integer' },
      },
      example: { thresholdPercent: 85, level: 'WARNING', isActive: true },
    },
  })
  @ApiOkResponse({ description: 'Alert rule updated', schema: RULE_SCHEMA })
  @ApiBadRequestResponse({ description: 'Invalid threshold, level, or message' })
  @ApiNotFoundResponse({ description: 'Alert rule not found' })
  @ApiConflictResponse({
    description: 'A rule already exists for this scope and threshold',
  })
  updateRule(@Param('id') id: string, @Body() body: UpdateTokenAlertRuleDto) {
    return this.tokenAlertRuleService.updateRule(id, body);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a token usage alert rule',
    description: 'Removes a single row from the alert rule table only.',
  })
  @ApiParam({ name: 'id', description: 'Alert rule id' })
  @ApiOkResponse({ description: 'Alert rule deleted', schema: RULE_SCHEMA })
  @ApiNotFoundResponse({ description: 'Alert rule not found' })
  deleteRule(@Param('id') id: string) {
    return this.tokenAlertRuleService.deleteRule(id);
  }
}
