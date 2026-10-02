// src/agent-team/agent-team.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AgentName } from 'src/generated/prisma/client';
import { AgentTeamService } from './agent-team.service';
import {
  CreateAgentTeamDto,
  ListAgentTeamsQuery,
  UpdateAgentTeamDto,
} from './dto/agent-team.dto';

const agentsSchema = {
  type: 'array',
  items: { type: 'string', enum: Object.values(AgentName) },
};

const teamResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    description: { type: 'string' },
    isActive: { type: 'boolean' },
    tokenLimit: {
      type: 'integer',
      nullable: true,
      description:
        'Default token allowance seeded onto each user assignment of this team; null = access only',
    },
    agents: agentsSchema,
    agentCount: { type: 'integer' },
    assignmentCount: {
      type: 'integer',
      description: 'AssignedTeam rows pointing at this team',
    },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  example: {
    id: '7f3e9a10-2b4c-4d5e-8f6a-1b2c3d4e5f60',
    name: 'Marketing Powerhouse',
    description: 'Content, outreach and follow-up agents',
    isActive: true,
    tokenLimit: 50000,
    agents: ['CHIARA_AI', 'JIM', 'LARA'],
    agentCount: 3,
    assignmentCount: 0,
    createdAt: '2026-09-11T09:15:00.000Z',
    updatedAt: '2026-09-11T09:15:00.000Z',
  },
};

const paginatedResponseSchema = {
  type: 'object',
  properties: {
    data: { type: 'array', items: teamResponseSchema },
    total: { type: 'integer', example: 1 },
    page: { type: 'integer', example: 1 },
    limit: { type: 'integer', example: 50 },
    totalPages: { type: 'integer', example: 1 },
  },
};

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@ApiTags('Teams')
@Controller('admin/teams')
export class AgentTeamController {
  constructor(private readonly service: AgentTeamService) {}

  @Post()
  @ApiOperation({
    summary: 'Create an agent team',
    description:
      'A team is a named bundle of agents. `agents` is optional; users are granted the whole bundle via `/admin/team-assignments`.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'description'],
      properties: {
        name: { type: 'string', example: 'Marketing Powerhouse' },
        description: {
          type: 'string',
          example: 'Content, outreach and follow-up agents',
        },
        agents: {
          ...agentsSchema,
          description: 'Optional; omit or send [] to create an empty team',
        },
        isActive: { type: 'boolean', example: true },
        tokenLimit: {
          type: 'integer',
          nullable: true,
          minimum: 0,
          example: 50000,
          description:
            'Default token allowance for the team. Seeds the tokenLimit of every user assignment created from it; omit or null for access only',
        },
      },
      example: {
        name: 'Marketing Powerhouse',
        description: 'Content, outreach and follow-up agents',
        agents: ['CHIARA_AI', 'JIM', 'LARA'],
        tokenLimit: 50000,
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Team created',
    schema: teamResponseSchema,
  })
  @ApiBadRequestResponse({
    description:
      'Validation failed (missing name/description or unknown agent)',
  })
  @ApiConflictResponse({ description: 'A team with this name already exists' })
  create(@Body() dto: CreateAgentTeamDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List agent teams (paginated)' })
  @ApiQuery({ name: 'search', required: false, description: 'Match on name' })
  @ApiQuery({
    name: 'agentName',
    required: false,
    enum: Object.values(AgentName),
    description: 'Only teams containing this agent',
  })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'updatedAt', 'name'],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiOkResponse({
    description: 'Teams returned',
    schema: paginatedResponseSchema,
  })
  findAll(@Query() q: ListAgentTeamsQuery) {
    return this.service.findAll(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an agent team by id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Team returned', schema: teamResponseSchema })
  @ApiNotFoundResponse({ description: 'Team not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an agent team',
    description:
      'Every field is optional. Sending `agents` replaces the whole list. `tokenLimit` is the default allowance seeded onto future user assignments of this team (null clears it); existing assignments keep their own limit.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        agents: { ...agentsSchema, description: 'Replaces the current list' },
        isActive: { type: 'boolean' },
        tokenLimit: {
          type: 'integer',
          nullable: true,
          minimum: 0,
          description: 'Null clears the allowance (access only)',
        },
      },
      example: {
        name: 'Marketing Powerhouse v2',
        agents: ['CHIARA_AI', 'JIM'],
        tokenLimit: 80000,
      },
    },
  })
  @ApiOkResponse({ description: 'Team updated', schema: teamResponseSchema })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiNotFoundResponse({ description: 'Team not found' })
  @ApiConflictResponse({ description: 'A team with this name already exists' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgentTeamDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete an agent team',
    description: 'Also removes every assignment of this team.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({
    description: 'Team deleted',
    schema: {
      type: 'object',
      properties: {
        deleted: { type: 'boolean', example: true },
        id: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Team not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
