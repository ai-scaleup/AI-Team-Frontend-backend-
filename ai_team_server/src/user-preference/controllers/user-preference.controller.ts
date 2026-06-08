import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AgentName } from 'src/generated/prisma/client';
import { UserPreferenceService } from '../services/user-preference.service';
import {
  CreateUserPreferenceDto,
  createUserPreferenceSchema,
  UpdateUserPreferenceDto,
  updateUserPreferenceSchema,
  agentNames,
} from '../schemas/user-preference.schema';
import { ZodValidationPipe } from 'src/pipes/zod.validation.pipe';

const preferenceBodySchema = {
  type: 'object',
  properties: {
    oauthId: { type: 'string', example: 'user_2abc123' },
    email: { type: 'string', format: 'email', example: 'jane@example.com' },
    agentName: { type: 'string', enum: [...agentNames], example: 'JIM' },
    displayName: { type: 'string', example: 'Jane' },
    businessName: { type: 'string', example: 'Jane Consulting' },
    contentLanguage: {
      type: 'string',
      enum: [
        'ITALIANO',
        'INGLESE',
        'SPAGNOLO',
        'FRANCESE',
        'TEDESCO',
        'PORTOGHESE',
        'ALTRO',
      ],
    },
    responseLanguage: {
      type: 'string',
      enum: [
        'ITALIANO',
        'INGLESE',
        'SPAGNOLO',
        'FRANCESE',
        'TEDESCO',
        'PORTOGHESE',
        'ALTRO',
      ],
    },
    toneOfVoice: {
      type: 'string',
      enum: [
        'PROFESSIONALE_FORMALE',
        'AMICHEVOLE_INFORMALE',
        'TECNICO_ESPERTO',
        'MOTIVAZIONALE_ENERGETICO',
        'EMPATICO_COMPRENSIVO',
        'INNOVATIVO_VISIONARIO',
        'DIVERTENTE_CREATIVO',
      ],
    },
    marketingKnowledge: {
      type: 'string',
      enum: ['BASE', 'INTERMEDIO', 'AVANZATO', 'EXPERT'],
    },
    responseLength: {
      type: 'string',
      enum: ['CONCISA', 'BILANCIATA', 'DETTAGLIATA'],
    },
    emojiUsage: {
      type: 'string',
      enum: ['MAI', 'MINIMO', 'MODERATO', 'FREQUENTE'],
    },
    proactivityLevel: {
      type: 'string',
      enum: ['SOLO_REATTIVO', 'MODERATAMENTE_PROATTIVO', 'MOLTO_PROATTIVO'],
    },
    questionStyle: {
      type: 'string',
      enum: ['UNA_ALLA_VOLTA', 'A_GRUPPI', 'MINIMO_INDISPENSABILE'],
    },
    decisionHelpStyle: {
      type: 'string',
      enum: ['ANALISI_OPZIONI', 'RACCOMANDAZIONE_DIRETTA', 'ENTRAMBI'],
    },
    learningPreference: {
      type: 'string',
      enum: [
        'APPRENDIMENTO_CONTINUO',
        'COMPORTAMENTO_STATICO',
        'AGGIORNAMENTI_PERIODICI',
      ],
    },
    marketComparison: {
      type: 'string',
      enum: ['SEMPRE', 'SOLO_RILEVANTI', 'MAI'],
    },
    onboardingCompleted: { type: 'boolean', example: false },
    onboardingStep: { type: 'integer', minimum: 0, example: 0 },
  },
};

@ApiTags('user-preferences')
@Controller('user-preferences')
export class UserPreferenceController {
  constructor(private readonly userPreferenceService: UserPreferenceService) {}

  /**
   * POST /user-preferences
   * Create new preferences for a user + agent combination
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create preferences for a user and agent' })
  @ApiBody({
    schema: {
      ...preferenceBodySchema,
      required: ['agentName'],
      anyOf: [{ required: ['oauthId'] }, { required: ['email'] }],
    },
  })
  @ApiCreatedResponse({ description: 'Preferences created' })
  create(
    @Body(new ZodValidationPipe(createUserPreferenceSchema))
    createDto: CreateUserPreferenceDto,
  ) {
    return this.userPreferenceService.createPreference(createDto);
  }

  /**
   * GET /user-preferences/:userIdentifier
   * Get all preferences for a user (across all agents)
   */
  @Get(':userIdentifier')
  @ApiOperation({
    summary: 'List all preferences for a user by email',
  })
  @ApiParam({ name: 'userIdentifier', example: 'jane@example.com' })
  @ApiOkResponse({ description: 'Preferences returned' })
  findAllByUser(@Param('userIdentifier') userIdentifier: string) {
    return this.userPreferenceService.findAllByUserIdentifier(userIdentifier);
  }

  /**
   * GET /user-preferences/:userIdentifier/:agentName
   * Get preferences for a specific user + agent
   */
  @Get(':userIdentifier/:agentName')
  @ApiOperation({
    summary: 'Get preferences for a user and agent by email',
  })
  @ApiParam({ name: 'userIdentifier', example: 'jane@example.com' })
  @ApiParam({ name: 'agentName', enum: agentNames })
  @ApiOkResponse({ description: 'Preferences returned' })
  findByUserAndAgent(
    @Param('userIdentifier') userIdentifier: string,
    @Param('agentName') agentName: AgentName,
  ) {
    return this.userPreferenceService.findByUserIdentifierAndAgent(
      userIdentifier,
      agentName,
    );
  }

  /**
   * GET /user-preferences/:userIdentifier/:agentName/or-create
   * Get preferences for a user + agent, creating defaults if not exists
   */
  @Get(':userIdentifier/:agentName/or-create')
  @ApiOperation({
    summary: 'Get preferences or create defaults by email',
  })
  @ApiParam({ name: 'userIdentifier', example: 'jane@example.com' })
  @ApiParam({ name: 'agentName', enum: agentNames })
  @ApiOkResponse({ description: 'Preferences returned or created' })
  getOrCreate(
    @Param('userIdentifier') userIdentifier: string,
    @Param('agentName') agentName: AgentName,
  ) {
    return this.userPreferenceService.getOrCreateDefaultByUserIdentifier(
      userIdentifier,
      agentName,
    );
  }

  /**
   * PUT /user-preferences/:userIdentifier/:agentName
   * Update preferences for a user + agent (must exist)
   */
  @Put(':userIdentifier/:agentName')
  @ApiOperation({ summary: 'Update existing preferences by OAuth ID or email' })
  @ApiParam({ name: 'userIdentifier', example: 'jane@example.com' })
  @ApiParam({ name: 'agentName', enum: agentNames })
  @ApiBody({ schema: preferenceBodySchema })
  @ApiOkResponse({ description: 'Preferences updated' })
  update(
    @Param('userIdentifier') userIdentifier: string,
    @Param('agentName') agentName: AgentName,
    @Body(new ZodValidationPipe(updateUserPreferenceSchema))
    updateDto: UpdateUserPreferenceDto,
  ) {
    return this.userPreferenceService.updateByUserIdentifierAndAgent(
      userIdentifier,
      agentName,
      updateDto,
    );
  }

  /**
   * PUT /user-preferences/:userIdentifier/:agentName/upsert
   * Create or update preferences for a user + agent
   */
  @Put(':userIdentifier/:agentName/upsert')
  @ApiOperation({
    summary: 'Create or update preferences by OAuth ID or email',
  })
  @ApiParam({ name: 'userIdentifier', example: 'jane@example.com' })
  @ApiParam({ name: 'agentName', enum: agentNames })
  @ApiBody({ schema: preferenceBodySchema })
  @ApiOkResponse({ description: 'Preferences upserted' })
  upsert(
    @Param('userIdentifier') userIdentifier: string,
    @Param('agentName') agentName: AgentName,
    @Body(new ZodValidationPipe(updateUserPreferenceSchema))
    updateDto: UpdateUserPreferenceDto,
  ) {
    return this.userPreferenceService.upsertByUserIdentifierAndAgent(
      userIdentifier,
      agentName,
      updateDto,
    );
  }

  /**
   * DELETE /user-preferences/:userIdentifier/:agentName
   * Delete preferences for a specific user + agent
   */
  @Delete(':userIdentifier/:agentName')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete preferences for a user and agent by OAuth ID or email',
  })
  @ApiParam({ name: 'userIdentifier', example: 'jane@example.com' })
  @ApiParam({ name: 'agentName', enum: agentNames })
  @ApiNoContentResponse({ description: 'Preferences deleted' })
  deleteByUserAndAgent(
    @Param('userIdentifier') userIdentifier: string,
    @Param('agentName') agentName: AgentName,
  ) {
    return this.userPreferenceService.deleteByUserIdentifierAndAgent(
      userIdentifier,
      agentName,
    );
  }

  /**
   * DELETE /user-preferences/:userIdentifier
   * Delete all preferences for a user
   */
  @Delete(':userIdentifier')
  @ApiOperation({
    summary: 'Delete all preferences for a user by OAuth ID or email',
  })
  @ApiParam({ name: 'userIdentifier', example: 'jane@example.com' })
  @ApiOkResponse({ description: 'Preferences deleted' })
  deleteAllByUser(@Param('userIdentifier') userIdentifier: string) {
    return this.userPreferenceService.deleteAllByUserIdentifier(userIdentifier);
  }
}
