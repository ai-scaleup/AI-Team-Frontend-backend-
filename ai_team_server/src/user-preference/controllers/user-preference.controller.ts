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
import { AgentName } from '@prisma/client';
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

@Controller('user-preferences')
export class UserPreferenceController {
    constructor(private readonly userPreferenceService: UserPreferenceService) { }

    /**
     * POST /user-preferences
     * Create new preferences for a user + agent combination
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
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
    findAllByUser(@Param('oauthId') oauthId: string) {
        return this.userPreferenceService.findAllByOauthId(oauthId);
    }

    /**
     * GET /user-preferences/:oauthId/:agentName
     * Get preferences for a specific user + agent
     */
    @Get(':oauthId/:agentName')
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
    deleteAllByUser(@Param('oauthId') oauthId: string) {
        return this.userPreferenceService.deleteAllByOauthId(oauthId);
    }
}
