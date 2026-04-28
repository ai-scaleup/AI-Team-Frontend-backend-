import { Controller, Get, Post, Body, Param, Query, Patch } from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AdminDashboardService } from './admin-dashboard.service';

@ApiTags('admin-dashboard')
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  @Post('memberships')
  @ApiOperation({ summary: 'Create a membership template' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: true,
      example: {
        name: 'Pro',
        durationDays: 30,
        monthlyTokenLimit: 100000,
        includedAgents: ['JIM'],
        includedGroupIds: [],
      },
    },
  })
  @ApiOkResponse({ description: 'Membership created' })
  createMembership(@Body() body: any) {
    return this.dashboardService.createMembership(body);
  }

  @Get('memberships')
  @ApiOperation({ summary: 'List membership templates' })
  @ApiOkResponse({ description: 'Memberships returned' })
  listMemberships() {
    return this.dashboardService.listMemberships();
  }

  @Post('memberships/assign')
  @ApiOperation({ summary: 'Assign a membership template to a user' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['userId', 'membershipTemplateId'],
      properties: {
        userId: { type: 'string', format: 'uuid' },
        membershipTemplateId: { type: 'string', format: 'uuid' },
        durationOverride: { type: 'integer', example: 30 },
      },
    },
  })
  @ApiOkResponse({ description: 'Membership assigned' })
  assignMembership(@Body() body: { userId: string; membershipTemplateId: string; durationOverride?: number }) {
    return this.dashboardService.assignMembership(body.userId, body.membershipTemplateId, body.durationOverride);
  }

  @Get('users')
  @ApiOperation({ summary: 'List dashboard users with usage details' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  @ApiOkResponse({ description: 'Users returned' })
  listUsers(@Query('search') search?: string, @Query('days') days?: string) {
    const daysLimit = days ? parseInt(days, 10) : 30;
    return this.dashboardService.listUsersDetailed(search, daysLimit);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get dashboard details for one user' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  @ApiOkResponse({ description: 'User details returned' })
  getUserDetails(@Param('id') id: string, @Query('days') days?: string) {
    const daysLimit = days ? parseInt(days, 10) : 30;
    return this.dashboardService.getUserDetails(id, daysLimit);
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
