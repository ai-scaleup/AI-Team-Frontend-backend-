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
    Query,
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
import { z } from 'zod';

// Validation schemas for params
const oauthIdParamSchema = z.string().min(1, { message: 'OAuth ID is required.' });
const agentNameParamSchema = z.enum(agentNames, { message: 'Valid agent name is required.' });

const preferenceBodySchema = {
    type: 'object',
    properties: {
        oauthId: { type: 'string', example: 'user_2abc123' },
        agentName: { type: 'string', enum: [...agentNames], example: 'JIM' },
        displayName: { type: 'string', example: 'Jane' },
        businessName: { type: 'string', example: 'Jane Consulting' },
        contentLanguage: { type: 'string', enum: ['ITALIANO', 'INGLESE', 'SPAGNOLO', 'FRANCESE', 'TEDESCO', 'PORTOGHESE', 'ALTRO'] },
        responseLanguage: { type: 'string', enum: ['ITALIANO', 'INGLESE', 'SPAGNOLO', 'FRANCESE', 'TEDESCO', 'PORTOGHESE', 'ALTRO'] },
        toneOfVoice: { type: 'string', enum: ['PROFESSIONALE_FORMALE', 'AMICHEVOLE_INFORMALE', 'TECNICO_ESPERTO', 'MOTIVAZIONALE_ENERGETICO', 'EMPATICO_COMPRENSIVO', 'INNOVATIVO_VISIONARIO', 'DIVERTENTE_CREATIVO'] },
        marketingKnowledge: { type: 'string', enum: ['BASE', 'INTERMEDIO', 'AVANZATO', 'EXPERT'] },
        responseLength: { type: 'string', enum: ['CONCISA', 'BILANCIATA', 'DETTAGLIATA'] },
        emojiUsage: { type: 'string', enum: ['MAI', 'MINIMO', 'MODERATO', 'FREQUENTE'] },
        proactivityLevel: { type: 'string', enum: ['SOLO_REATTIVO', 'MODERATAMENTE_PROATTIVO', 'MOLTO_PROATTIVO'] },
        questionStyle: { type: 'string', enum: ['UNA_ALLA_VOLTA', 'A_GRUPPI', 'MINIMO_INDISPENSABILE'] },
        decisionHelpStyle: { type: 'string', enum: ['ANALISI_OPZIONI', 'RACCOMANDAZIONE_DIRETTA', 'ENTRAMBI'] },
        learningPreference: { type: 'string', enum: ['APPRENDIMENTO_CONTINUO', 'COMPORTAMENTO_STATICO', 'AGGIORNAMENTI_PERIODICI'] },
        marketComparison: { type: 'string', enum: ['SEMPRE', 'SOLO_RILEVANTI', 'MAI'] },
        onboardingCompleted: { type: 'boolean', example: false },
        onboardingStep: { type: 'integer', minimum: 0, example: 0 },
    },
};

@ApiTags('user-preferences')
@Controller('user-preferences')
export class UserPreferenceController {
    constructor(private readonly userPreferenceService: UserPreferenceService) { }

    /**
     * POST /user-preferences
     * Create new preferences for a user + agent combination
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create preferences for a user and agent' })
    @ApiBody({ schema: { ...preferenceBodySchema, required: ['oauthId', 'agentName'] } })
    @ApiCreatedResponse({ description: 'Preferences created' })
    create(
        @Body(new ZodValidationPipe(createUserPreferenceSchema))
        createDto: CreateUserPreferenceDto,
    ) {
        return this.userPreferenceService.createPreference(createDto);
    }

    /**
     * GET /user-preferences/:oauthId
     * Get all preferences for a user (across all agents)
     */
    @Get(':oauthId')
    @ApiOperation({ summary: 'List all preferences for a user' })
    @ApiParam({ name: 'oauthId', example: 'user_2abc123' })
    @ApiOkResponse({ description: 'Preferences returned' })
    findAllByUser(@Param('oauthId') oauthId: string) {
        return this.userPreferenceService.findAllByOauthId(oauthId);
    }

    /**
     * GET /user-preferences/:oauthId/:agentName
     * Get preferences for a specific user + agent
     */
    @Get(':oauthId/:agentName')
    @ApiOperation({ summary: 'Get preferences for a user and agent' })
    @ApiParam({ name: 'oauthId', example: 'user_2abc123' })
    @ApiParam({ name: 'agentName', enum: agentNames })
    @ApiOkResponse({ description: 'Preferences returned' })
    findByUserAndAgent(
        @Param('oauthId') oauthId: string,
        @Param('agentName') agentName: AgentName,
    ) {
        return this.userPreferenceService.findByOauthIdAndAgent(oauthId, agentName);
    }

    /**
     * GET /user-preferences/:oauthId/:agentName/or-create
     * Get preferences for a user + agent, creating defaults if not exists
     */
    @Get(':oauthId/:agentName/or-create')
    @ApiOperation({ summary: 'Get preferences or create defaults' })
    @ApiParam({ name: 'oauthId', example: 'user_2abc123' })
    @ApiParam({ name: 'agentName', enum: agentNames })
    @ApiOkResponse({ description: 'Preferences returned or created' })
    getOrCreate(
        @Param('oauthId') oauthId: string,
        @Param('agentName') agentName: AgentName,
    ) {
        return this.userPreferenceService.getOrCreateDefault(oauthId, agentName);
    }

    /**
     * PUT /user-preferences/:oauthId/:agentName
     * Update preferences for a user + agent (must exist)
     */
    @Put(':oauthId/:agentName')
    @ApiOperation({ summary: 'Update existing preferences' })
    @ApiParam({ name: 'oauthId', example: 'user_2abc123' })
    @ApiParam({ name: 'agentName', enum: agentNames })
    @ApiBody({ schema: preferenceBodySchema })
    @ApiOkResponse({ description: 'Preferences updated' })
    update(
        @Param('oauthId') oauthId: string,
        @Param('agentName') agentName: AgentName,
        @Body(new ZodValidationPipe(updateUserPreferenceSchema))
        updateDto: UpdateUserPreferenceDto,
    ) {
        return this.userPreferenceService.updateByOauthIdAndAgent(oauthId, agentName, updateDto);
    }

    /**
     * PUT /user-preferences/:oauthId/:agentName/upsert
     * Create or update preferences for a user + agent
     */
    @Put(':oauthId/:agentName/upsert')
    @ApiOperation({ summary: 'Create or update preferences' })
    @ApiParam({ name: 'oauthId', example: 'user_2abc123' })
    @ApiParam({ name: 'agentName', enum: agentNames })
    @ApiBody({ schema: preferenceBodySchema })
    @ApiOkResponse({ description: 'Preferences upserted' })
    upsert(
        @Param('oauthId') oauthId: string,
        @Param('agentName') agentName: AgentName,
        @Body(new ZodValidationPipe(updateUserPreferenceSchema))
        updateDto: UpdateUserPreferenceDto,
    ) {
        return this.userPreferenceService.upsertByOauthIdAndAgent(oauthId, agentName, updateDto);
    }

    /**
     * DELETE /user-preferences/:oauthId/:agentName
     * Delete preferences for a specific user + agent
     */
    @Delete(':oauthId/:agentName')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete preferences for a user and agent' })
    @ApiParam({ name: 'oauthId', example: 'user_2abc123' })
    @ApiParam({ name: 'agentName', enum: agentNames })
    @ApiNoContentResponse({ description: 'Preferences deleted' })
    deleteByUserAndAgent(
        @Param('oauthId') oauthId: string,
        @Param('agentName') agentName: AgentName,
    ) {
        return this.userPreferenceService.deleteByOauthIdAndAgent(oauthId, agentName);
    }

    /**
     * DELETE /user-preferences/:oauthId
     * Delete all preferences for a user
     */
    @Delete(':oauthId')
    @ApiOperation({ summary: 'Delete all preferences for a user' })
    @ApiParam({ name: 'oauthId', example: 'user_2abc123' })
    @ApiOkResponse({ description: 'Preferences deleted' })
    deleteAllByUser(@Param('oauthId') oauthId: string) {
        return this.userPreferenceService.deleteAllByOauthId(oauthId);
    }
}
