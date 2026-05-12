import {
  Controller,
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

@ApiTags('admin-dashboard')
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

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
  @ApiOkResponse({ description: 'User details returned' })
  getUserDetails(@Param('id') id: string, @Query('days') days?: string) {
    const daysLimit = days ? parseInt(days, 10) : 30;
    return this.dashboardService.getUserDetails(id, daysLimit);
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
