import { Controller, Get, Post, Body, Param, Query, Patch } from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service';

@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  @Post('memberships')
  createMembership(@Body() body: any) {
    return this.dashboardService.createMembership(body);
  }

  @Get('memberships')
  listMemberships() {
    return this.dashboardService.listMemberships();
  }

  @Post('memberships/assign')
  assignMembership(@Body() body: { userId: string; membershipTemplateId: string; durationOverride?: number }) {
    return this.dashboardService.assignMembership(body.userId, body.membershipTemplateId, body.durationOverride);
  }

  @Get('users')
  listUsers(@Query('search') search?: string, @Query('days') days?: string) {
    const daysLimit = days ? parseInt(days, 10) : 30;
    return this.dashboardService.listUsersDetailed(search, daysLimit);
  }

  @Get('users/:id')
  getUserDetails(@Param('id') id: string, @Query('days') days?: string) {
    const daysLimit = days ? parseInt(days, 10) : 30;
    return this.dashboardService.getUserDetails(id, daysLimit);
  }

  @Patch('users/bulk')
  bulkUpdateUsers(@Body() body: { userIds: string[]; updates: any }) {
    return this.dashboardService.bulkUpdateUsers(body.userIds, body.updates);
  }
}
