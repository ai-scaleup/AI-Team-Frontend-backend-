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
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AgentName } from 'src/generated/prisma/client';
import {
  AddMembershipAgentsDto,
  AddMembershipTeamsDto,
  AssignMembershipDto,
  CreateMembershipDto,
  RecordMembershipTokenUsageByEmailDto,
  RecordMembershipTokenUsageDto,
  UpdateMembershipAssignmentDto,
  UpdateMembershipDto,
} from './dto/membership.dto';
import { MembershipService } from './membership.service';

const ASSIGNMENT_RESPONSE = {
  description:
    'The grant with its shared pool: monthlyTokenLimit is the allowance every agent of the membership draws on together, usedTokens / inputTokens / outputTokens are their combined spend in the current 30-day cycle (summed from the usage ledger for every covered agent since the start of the day cycleStartsAt falls on), tokensLeft is what is left for all of them.',
};

/**
 * Membership templates. A template bundles two separate lists: single agents
 * (includedAgents) and agent teams (includedTeamIds, the AgentTeam ids from
 * /admin/teams). Each list has its own add/remove endpoints.
 *
 * A template's monthlyTokenLimit is SHARED: when the template is assigned,
 * the grant carries one pool that every agent it reaches draws on, so a chat
 * with any of them moves the same counters. The assignment endpoints below
 * expose and edit that pool. (Static assignment routes are declared before
 * the `:id` template routes so `GET assignments` is not read as a template
 * id.)
 */
@ApiTags('Memberships')
@Controller('admin/memberships')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  /* ------------------------------ assignment ---------------------------- */

  @Post('assign')
  @ApiOperation({
    summary: 'Assign a membership template to a user',
    description:
      "Creates the grant. Its first 30-day cycle starts today, so whatever the membership's agents already spent today counts against the pool from the start. The allowance is the override, else the template's monthlyTokenLimit, and every agent the membership reaches spends from this one pool.",
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['userId', 'membershipTemplateId'],
      properties: {
        userId: { type: 'string', format: 'uuid' },
        membershipTemplateId: { type: 'string', format: 'uuid' },
        durationOverride: { type: 'integer', example: 30 },
        monthlyTokenLimitOverride: {
          type: 'integer',
          minimum: 0,
          example: 80000,
          description:
            'Shared allowance per 30-day cycle for this grant; defaults to the template figure.',
        },
      },
    },
  })
  @ApiOkResponse(ASSIGNMENT_RESPONSE)
  assignMembership(@Body() body: AssignMembershipDto) {
    return this.membershipService.assignMembership(
      body.userId,
      body.membershipTemplateId,
      body.durationOverride,
      body.monthlyTokenLimitOverride,
    );
  }

  @Get('assignments')
  @ApiOperation({
    summary: 'List membership assignments with their shared pools',
  })
  @ApiQuery({ name: 'userId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'email', required: false, example: 'user@example.com' })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    type: Boolean,
    description: 'Only active, unexpired grants',
  })
  @ApiOkResponse({ description: 'Membership assignments returned' })
  listAssignments(
    @Query('userId') userId?: string,
    @Query('email') email?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.membershipService.listAssignments({
      userId,
      email,
      activeOnly: activeOnly === 'true' || activeOnly === '1',
    });
  }

  @Get('assignments/:assignmentId')
  @ApiOperation({ summary: 'Get a membership assignment and its shared pool' })
  @ApiParam({ name: 'assignmentId', description: 'Assigned membership id' })
  @ApiOkResponse(ASSIGNMENT_RESPONSE)
  getAssignment(@Param('assignmentId') assignmentId: string) {
    return this.membershipService.getAssignment(assignmentId);
  }

  @Patch('assignments/:assignmentId')
  @ApiOperation({
    summary: "Update a membership assignment's shared allowance or timing",
    description:
      'Changing monthlyTokenLimit re-prices tokensLeft against the spend already recorded this cycle; it does not hand the pool back. An explicit expiresAt wins over durationDays, which is counted from the grant start.',
  })
  @ApiParam({ name: 'assignmentId', description: 'Assigned membership id' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        monthlyTokenLimit: { type: 'integer', minimum: 0, example: 120000 },
        expiresAt: { type: 'string', format: 'date-time', nullable: true },
        durationDays: { type: 'integer', minimum: 1, example: 30 },
        isActive: { type: 'boolean' },
      },
    },
  })
  @ApiOkResponse(ASSIGNMENT_RESPONSE)
  updateAssignment(
    @Param('assignmentId') assignmentId: string,
    @Body() body: UpdateMembershipAssignmentDto,
  ) {
    return this.membershipService.updateAssignment(assignmentId, body);
  }

  @Patch('assignments/:assignmentId/token-usage')
  @ApiOperation({
    summary: "Record a chat's spend against a membership's shared pool",
    description:
      "Records what one chat cost against the grant's ONE shared pool. agentName says which of the membership's agents was chatting (it must be one the membership reaches, as a single agent or through one of its teams) -- the spend is not kept per agent, it comes off the same pool whichever agent it was, so the pool ALEX drains is the pool LARA finds empty. inputTokens and outputTokens are signed deltas: positive spends, negative refunds. The spend is written to the agent's usage ledger (each counter floored at 0), and the pool is then re-summed from the ledger over all the membership's agents for the current cycle: tokensLeft = max(0, monthlyTokenLimit - usedTokens).",
  })
  @ApiParam({ name: 'assignmentId', description: 'Assigned membership id' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['agentName', 'inputTokens', 'outputTokens'],
      properties: {
        agentName: { enum: Object.values(AgentName), example: 'ALEX' },
        inputTokens: { type: 'integer', example: 1200 },
        outputTokens: { type: 'integer', example: 1300 },
      },
    },
  })
  @ApiOkResponse(ASSIGNMENT_RESPONSE)
  recordTokenUsage(
    @Param('assignmentId') assignmentId: string,
    @Body() body: RecordMembershipTokenUsageDto,
  ) {
    return this.membershipService.recordTokenUsage(
      assignmentId,
      body?.agentName,
      body,
    );
  }

  @Patch('token-usage')
  @ApiOperation({
    summary: "Update a user's membership tokens by email",
    description:
      "Finds the user's active grant of the membership (membershipId is the template id; an assignment id of that user also works) and records the chat's input/output tokens for agentName against its shared pool. The agent must be one the membership reaches. Returns the pool: monthlyTokenLimit, usedTokens / inputTokens / outputTokens for the current cycle, and tokensLeft = max(0, monthlyTokenLimit - usedTokens).",
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'email',
        'membershipId',
        'agentName',
        'inputTokens',
        'outputTokens',
      ],
      properties: {
        email: { type: 'string', example: 'user@example.com' },
        membershipId: { type: 'string', format: 'uuid' },
        agentName: { enum: Object.values(AgentName), example: 'ALEX' },
        inputTokens: { type: 'integer', example: 1200 },
        outputTokens: { type: 'integer', example: 1300 },
      },
    },
  })
  @ApiOkResponse(ASSIGNMENT_RESPONSE)
  recordTokenUsageByEmail(@Body() body: RecordMembershipTokenUsageByEmailDto) {
    return this.membershipService.recordTokenUsageByEmail(body);
  }

  @Delete('assignments/:assignmentId')
  @ApiOperation({
    summary: "Revoke a user's membership assignment",
    description:
      'Marks the assignment inactive. The row and its usage history are kept.',
  })
  @ApiParam({ name: 'assignmentId', description: 'Assigned membership id' })
  @ApiOkResponse({ description: 'Membership assignment revoked' })
  revokeMembership(@Param('assignmentId') assignmentId: string) {
    return this.membershipService.revokeMembership(assignmentId);
  }

  /* ------------------------------ templates ----------------------------- */

  @Post()
  @ApiOperation({
    summary: 'Create a membership template',
    description:
      'monthlyTokenLimit is a SHARED allowance: once assigned, every agent the membership reaches spends from the same pool.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: true,
      example: {
        name: 'Pro',
        durationDays: 30,
        monthlyTokenLimit: 100000,
        includedAgents: ['JIM'],
        includedTeamIds: ['1f0a6d4c-1c3e-4d1a-9b52-1a2b3c4d5e6f'],
      },
    },
  })
  @ApiOkResponse({ description: 'Membership created' })
  createMembership(@Body() body: CreateMembershipDto) {
    return this.membershipService.createMembership(body);
  }

  @Get()
  @ApiOperation({ summary: 'List membership templates' })
  @ApiOkResponse({ description: 'Memberships returned' })
  listMemberships() {
    return this.membershipService.listMemberships();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a membership template by id' })
  @ApiParam({ name: 'id', description: 'Membership template id' })
  @ApiOkResponse({ description: 'Membership returned' })
  getMembership(@Param('id') id: string) {
    return this.membershipService.getMembership(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a membership template' })
  @ApiParam({ name: 'id', description: 'Membership template id' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: true,
      example: {
        name: 'Pro Plus',
        durationDays: 60,
        monthlyTokenLimit: 150000,
        // Replaces the single-agent list. Omit to leave it as it is.
        includedAgents: ['JIM', 'SARA_AI'],
        // Replaces the team list. Omit to leave it as it is; an empty array
        // unlinks every team.
        includedTeamIds: ['1f0a6d4c-1c3e-4d1a-9b52-1a2b3c4d5e6f'],
      },
    },
  })
  @ApiOkResponse({ description: 'Membership updated' })
  updateMembership(@Param('id') id: string, @Body() body: UpdateMembershipDto) {
    return this.membershipService.updateMembership(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a membership template' })
  @ApiParam({ name: 'id', description: 'Membership template id' })
  @ApiOkResponse({ description: 'Membership deleted' })
  deleteMembership(@Param('id') id: string) {
    return this.membershipService.deleteMembership(id);
  }

  /* --------------------------- single agents ---------------------------- */

  @Post(':id/agents')
  @ApiOperation({ summary: 'Add single agents to a membership template' })
  @ApiParam({ name: 'id', description: 'Membership template id' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['agents'],
      example: { agents: ['TONY', 'LARA'] },
    },
  })
  @ApiOkResponse({ description: 'Membership updated' })
  addAgents(@Param('id') id: string, @Body() body: AddMembershipAgentsDto) {
    return this.membershipService.addAgents(id, body.agents);
  }

  @Delete(':id/agents/:agentName')
  @ApiOperation({ summary: 'Remove a single agent from a membership template' })
  @ApiParam({ name: 'id', description: 'Membership template id' })
  @ApiParam({ name: 'agentName', enum: AgentName })
  @ApiOkResponse({ description: 'Membership updated' })
  removeAgent(@Param('id') id: string, @Param('agentName') agentName: string) {
    return this.membershipService.removeAgent(id, agentName);
  }

  /* -------------------------------- teams ------------------------------- */

  @Post(':id/teams')
  @ApiOperation({ summary: 'Add agent teams to a membership template' })
  @ApiParam({ name: 'id', description: 'Membership template id' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['teamIds'],
      example: { teamIds: ['1f0a6d4c-1c3e-4d1a-9b52-1a2b3c4d5e6f'] },
    },
  })
  @ApiOkResponse({ description: 'Membership updated' })
  addTeams(@Param('id') id: string, @Body() body: AddMembershipTeamsDto) {
    return this.membershipService.addTeams(id, body.teamIds);
  }

  @Delete(':id/teams/:teamId')
  @ApiOperation({ summary: 'Remove an agent team from a membership template' })
  @ApiParam({ name: 'id', description: 'Membership template id' })
  @ApiParam({ name: 'teamId', description: 'Agent team id' })
  @ApiOkResponse({ description: 'Membership updated' })
  removeTeam(@Param('id') id: string, @Param('teamId') teamId: string) {
    return this.membershipService.removeTeam(id, teamId);
  }
}
