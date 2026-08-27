import {
  Controller,
  Delete,
  Get,
  Body,
  Param,
  Query,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AdminDashboardService } from './admin-dashboard.service';
import {
  AssignMembershipDto,
  CreateMembershipDto,
} from 'src/membership/dto/membership.dto';
import { MembershipService } from 'src/membership/membership.service';

const parseOptionalDate = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

@ApiTags('admin-dashboard')
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(
    private readonly dashboardService: AdminDashboardService,
    private readonly membershipService: MembershipService,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'List dashboard users with usage details' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  @ApiOkResponse({ description: 'Users returned' })
  listUsers(@Query('search') search?: string, @Query('days') days?: string) {
    const daysLimit = days ? parseInt(days, 10) : 30;
    return this.dashboardService.listUsersDetailed(search, daysLimit);
  }

  @Get('recent-assignments')
  @ApiOperation({ summary: 'List recent assignment activity for admin dashboard' })
  @ApiQuery({ name: 'limit', required: false, example: 6 })
  @ApiOkResponse({ description: 'Recent assignments returned' })
  listRecentAssignments(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 6;
    return this.dashboardService.listRecentAssignments(parsedLimit);
  }

  @Get('memberships')
  @ApiOperation({
    summary: 'List membership templates for admin dashboard',
  })
  @ApiOkResponse({ description: 'Memberships returned' })
  listMemberships() {
    return this.membershipService.listMemberships();
  }

  @Post('memberships')
  @ApiOperation({
    summary: 'Create a membership template from admin dashboard',
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
        includedGroupIds: ['1f0a6d4c-1c3e-4d1a-9b52-1a2b3c4d5e6f'],
      },
    },
  })
  @ApiOkResponse({ description: 'Membership created' })
  createMembership(@Body() body: CreateMembershipDto) {
    return this.membershipService.createMembership(body);
  }

  @Post('memberships/assign')
  @ApiOperation({
    summary: 'Assign a membership template from admin dashboard',
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
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Membership assigned' })
  assignMembership(@Body() body: AssignMembershipDto) {
    return this.membershipService.assignMembership(
      body.userId,
      body.membershipTemplateId,
      body.durationOverride,
      body.monthlyTokenLimitOverride,
    );
  }

  @Get('usage/agent-metrics')
  @ApiOperation({
    summary: 'Get system-wide daily token usage and top users by agent',
  })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  @ApiQuery({ name: 'topLimit', required: false, example: 5 })
  @ApiOkResponse({ description: 'Agent usage metrics returned' })
  getAgentUsageMetrics(
    @Query('days') days?: string,
    @Query('topLimit') topLimit?: string,
  ) {
    const parsedDays = days ? parseInt(days, 10) : 30;
    const parsedTopLimit = topLimit ? parseInt(topLimit, 10) : 5;
    return this.dashboardService.getAgentUsageMetrics(
      parsedDays,
      parsedTopLimit,
    );
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get dashboard details for one user' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  @ApiQuery({ name: 'usageFrom', required: false })
  @ApiQuery({ name: 'usageTo', required: false })
  @ApiOkResponse({ description: 'User details returned' })
  getUserDetails(
    @Param('id') id: string,
    @Query('days') days?: string,
    @Query('usageFrom') usageFrom?: string,
    @Query('usageTo') usageTo?: string,
  ) {
    const daysLimit = days ? parseInt(days, 10) : 30;
    return this.dashboardService.getUserDetails(
      id,
      daysLimit,
      parseOptionalDate(usageFrom),
      parseOptionalDate(usageTo),
    );
  }

  @Patch('assignments/:type/:id')
  @ApiOperation({ summary: 'Update an existing user assignment' })
  @ApiParam({
    name: 'type',
    enum: ['agent', 'group', 'team', 'membership'],
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        startsAt: { type: 'string', format: 'date-time' },
        expiresAt: { type: 'string', format: 'date-time', nullable: true },
        durationDays: { type: 'integer', minimum: 1 },
        monthlyTokenLimit: { type: 'integer', minimum: 0 },
        isActive: { type: 'boolean' },
      },
    },
  })
  @ApiOkResponse({ description: 'Assignment updated' })
  updateAssignment(
    @Param('type') type: 'agent' | 'group' | 'team' | 'membership',
    @Param('id') id: string,
    @Body()
    body: {
      startsAt?: string;
      expiresAt?: string | null;
      durationDays?: number;
      monthlyTokenLimit?: number;
      isActive?: boolean;
    },
  ) {
    return this.dashboardService.updateAssignment(type, id, body);
  }

  @Delete('assignments/:type/:id')
  @ApiOperation({ summary: 'Delete an existing user assignment' })
  @ApiParam({
    name: 'type',
    enum: ['agent', 'group', 'team', 'membership'],
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Assignment deleted' })
  deleteAssignment(
    @Param('type') type: 'agent' | 'group' | 'team' | 'membership',
    @Param('id') id: string,
  ) {
    return this.dashboardService.deleteAssignment(type, id);
  }

  @Post('usage/reset-all')
  @ApiOperation({
    summary: 'Reset token usage and quota stop counters for all users',
  })
  @ApiOkResponse({ description: 'All usage counters reset' })
  resetAllUsage() {
    return this.dashboardService.resetAllUsage();
  }

  @Patch('users/bulk')
  @ApiOperation({ summary: 'Bulk update dashboard users' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['userIds', 'updates'],
      properties: {
        userIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
        updates: { type: 'object', additionalProperties: true },
      },
    },
  })
  @ApiOkResponse({ description: 'Users updated' })
  bulkUpdateUsers(@Body() body: { userIds: string[]; updates: any }) {
    return this.dashboardService.bulkUpdateUsers(body.userIds, body.updates);
  }
}
