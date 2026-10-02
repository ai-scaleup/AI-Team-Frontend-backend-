// src/agent-team/team-assignment.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
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
import {
  CreateTeamAssignmentDto,
  ListTeamAssignmentsQuery,
  RecordTeamAgentTokenUsageDto,
  UpdateTeamAssignmentDto,
} from './dto/team-assignment.dto';
import { TeamAssignmentService } from './team-assignment.service';

const timingSchema = {
  startsAt: { type: 'string', format: 'date-time' },
  expiresAt: { type: 'string', format: 'date-time', nullable: true },
  durationDays: { type: 'integer', minimum: 1, example: 30 },
  isActive: { type: 'boolean', example: true },
  tokenLimit: {
    type: 'integer',
    minimum: 0,
    nullable: true,
    example: 500000,
    description:
      "Per-agent allowance: EVERY agent in the team gets this many tokens on its own row. Defaults to the team's tokenLimit when omitted; null = access only",
  },
};

const assignmentResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    userId: { type: 'string', format: 'uuid' },
    teamId: { type: 'string', format: 'uuid' },
    startsAt: { type: 'string', format: 'date-time' },
    expiresAt: { type: 'string', format: 'date-time', nullable: true },
    durationDays: { type: 'integer', nullable: true },
    isActive: { type: 'boolean' },
    tokenLimit: { type: 'integer', nullable: true },
    usedTokens: { type: 'integer' },
    inputTokens: { type: 'integer' },
    outputTokens: { type: 'integer' },
    tokensLeft: {
      type: 'integer',
      nullable: true,
      description:
        'Sum of tokensLeft across the agent rows; null when the grant is access only',
    },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    agents: {
      type: 'array',
      description:
        'One row per agent in the team, each with its own allowance and spend',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          agentName: { type: 'string', enum: Object.values(AgentName) },
          tokenLimit: { type: 'integer', nullable: true },
          usedTokens: { type: 'integer' },
          inputTokens: { type: 'integer' },
          outputTokens: { type: 'integer' },
          tokensLeft: { type: 'integer', nullable: true },
        },
      },
    },
    user: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        oauthId: { type: 'string' },
        username: { type: 'string', nullable: true },
      },
    },
    team: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        description: { type: 'string' },
        isActive: { type: 'boolean' },
        agents: {
          type: 'array',
          items: { type: 'string', enum: Object.values(AgentName) },
        },
      },
    },
  },
  example: {
    id: 'c0ffee00-1234-4abc-9def-0123456789ab',
    userId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    teamId: '7f3e9a10-2b4c-4d5e-8f6a-1b2c3d4e5f60',
    startsAt: '2026-09-11T00:00:00.000Z',
    expiresAt: '2026-10-11T00:00:00.000Z',
    durationDays: 30,
    isActive: true,
    tokenLimit: 500000,
    usedTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    tokensLeft: 1500000,
    createdAt: '2026-09-11T09:15:00.000Z',
    updatedAt: '2026-09-11T09:15:00.000Z',
    agents: [
      {
        id: '5d1e2f30-4a5b-4c6d-8e7f-9a0b1c2d3e4f',
        agentName: 'CHIARA_AI',
        tokenLimit: 500000,
        usedTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        tokensLeft: 500000,
      },
      {
        id: '6e2f3a41-5b6c-4d7e-9f80-0b1c2d3e4f50',
        agentName: 'JIM',
        tokenLimit: 500000,
        usedTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        tokensLeft: 500000,
      },
      {
        id: '7f3a4b52-6c7d-4e8f-a091-1c2d3e4f5061',
        agentName: 'LARA',
        tokenLimit: 500000,
        usedTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        tokensLeft: 500000,
      },
    ],
    user: {
      id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      email: 'user@example.com',
      oauthId: 'user_2abcDEFghiJKL',
      username: 'Mario Rossi',
    },
    team: {
      id: '7f3e9a10-2b4c-4d5e-8f6a-1b2c3d4e5f60',
      name: 'Marketing Powerhouse',
      description: 'Content, outreach and follow-up agents',
      isActive: true,
      agents: ['CHIARA_AI', 'JIM', 'LARA'],
    },
  },
};

const paginatedResponseSchema = {
  type: 'object',
  properties: {
    data: { type: 'array', items: assignmentResponseSchema },
    total: { type: 'integer', example: 1 },
    page: { type: 'integer', example: 1 },
    limit: { type: 'integer', example: 50 },
    totalPages: { type: 'integer', example: 1 },
  },
};

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@ApiTags('Teams')
@Controller('admin/team-assignments')
export class TeamAssignmentController {
  constructor(private readonly service: TeamAssignmentService) {}

  @Post()
  @ApiOperation({
    summary: 'Assign a team to a user',
    description:
      "Target the user by `email` or `userId` and the team by `teamId` or `teamName`. Every agent in the team gets its own per-agent allowance: `tokenLimit` from the request, else the team's default. Refused with 409 if the user already holds an active assignment for that team — PATCH it instead.",
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        userId: { type: 'string', format: 'uuid' },
        teamId: { type: 'string', format: 'uuid' },
        teamName: { type: 'string' },
        ...timingSchema,
      },
      example: {
        email: 'user@example.com',
        teamId: '7f3e9a10-2b4c-4d5e-8f6a-1b2c3d4e5f60',
        durationDays: 30,
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Team assignment created',
    schema: assignmentResponseSchema,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed, or user/team selector missing',
  })
  @ApiNotFoundResponse({ description: 'User or team not found' })
  @ApiConflictResponse({ description: 'Active team assignment already exists' })
  create(@Body() dto: CreateTeamAssignmentDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List team assignments (paginated)' })
  @ApiQuery({ name: 'email', required: false, format: 'email' })
  @ApiQuery({ name: 'userId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'teamId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    type: Boolean,
    description: 'isActive AND not expired',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'updatedAt', 'startsAt', 'expiresAt'],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiOkResponse({
    description: 'Team assignments returned',
    schema: paginatedResponseSchema,
  })
  findAll(@Query() q: ListTeamAssignmentsQuery) {
    return this.service.findAll(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a team assignment by id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({
    description: 'Team assignment returned',
    schema: assignmentResponseSchema,
  })
  @ApiNotFoundResponse({ description: 'Team assignment not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':email/:teamId/:agentName/token-usage')
  @ApiOperation({
    summary: "Apply a chat's token spend to one agent of a user's team assignment",
    description:
      "Records what one chat cost against the user's live grant for this team, on the row of the agent the chat ran against. The chat sends its inputTokens and outputTokens; the spend is their sum. Both are deltas: a positive number is subtracted from that agent's allowance, a negative one is added back (a refund or a correction). The agent's tokenLimit is the admin's number and is left alone; usedTokens rolls up by inputTokens + outputTokens and tokensLeft is re-derived as max(0, tokenLimit - usedTokens). The grant's own usedTokens / tokensLeft are re-summed from its agent rows. Only this team grant moves: the single-agent grant, membership pools and usage ledger are left alone. A row with no tokenLimit still accumulates usedTokens and keeps tokensLeft null.",
  })
  @ApiParam({
    name: 'email',
    format: 'email',
    example: 'user@example.com',
    description: 'Email of the user who owns the team assignment.',
  })
  @ApiParam({
    name: 'teamId',
    format: 'uuid',
    example: '7f3e9a10-2b4c-4d5e-8f6a-1b2c3d4e5f60',
    description: 'Team the user holds an active assignment for.',
  })
  @ApiParam({
    name: 'agentName',
    enum: Object.values(AgentName),
    example: 'JIM',
    description: 'Agent in the team the chat ran against.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['inputTokens', 'outputTokens'],
      properties: {
        inputTokens: {
          type: 'integer',
          example: 800,
          description:
            'Prompt tokens the chat consumed. Negative gives the allowance back.',
        },
        outputTokens: {
          type: 'integer',
          example: 450,
          description:
            'Completion tokens the chat produced. Negative gives the allowance back.',
        },
      },
      example: { inputTokens: 800, outputTokens: 450 },
    },
  })
  @ApiOkResponse({
    description:
      "Usage applied to the agent row (usedTokens += inputTokens + outputTokens); the updated team assignment is returned",
    schema: assignmentResponseSchema,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid email, teamId, agent name, inputTokens, or outputTokens value',
  })
  @ApiNotFoundResponse({
    description:
      'User not found, no active assignment for this team, or the agent is not in the team',
  })
  recordAgentTokenUsage(
    @Param('email') email: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('agentName', new ParseEnumPipe(AgentName)) agentName: AgentName,
    @Body() dto: RecordTeamAgentTokenUsageDto,
  ) {
    return this.service.recordAgentTokenUsage(email, teamId, agentName, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a team assignment',
    description:
      'Every field is optional. `expiresAt` (null clears) beats `durationDays`. A new `tokenLimit` is applied to every agent row of the grant (each keeps its own spend) and the grant rollup is re-derived.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: timingSchema,
      example: { expiresAt: '2026-12-31T23:59:59.000Z', tokenLimit: 800000 },
    },
  })
  @ApiOkResponse({
    description: 'Team assignment updated',
    schema: assignmentResponseSchema,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiNotFoundResponse({ description: 'Team assignment not found' })
  @ApiConflictResponse({
    description: 'Re-activating would create a second active assignment',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamAssignmentDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a team assignment' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({
    description: 'Team assignment deleted',
    schema: {
      type: 'object',
      properties: {
        deleted: { type: 'boolean', example: true },
        id: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Team assignment not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
