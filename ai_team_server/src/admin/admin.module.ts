// src/admin/admin.module.ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthMiddleware } from '../auth/auth.middleware';

import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { MembershipModule } from 'src/membership/membership.module';
import { TokenUsageModule } from 'src/token-usage/token-usage.module';
import { SingleAssignedAgentModule } from 'src/single-assigned-agent/single-assigned-agent.module';

@Module({
  imports: [MembershipModule, TokenUsageModule, SingleAssignedAgentModule],
  controllers: [AdminController, AdminDashboardController],
  // PrismaModule is global. Providing PrismaService again here creates a
  // second connection pool and needlessly consumes scarce Supabase sessions.
  providers: [AdminService, AdminDashboardService],
  exports: [AdminService, AdminDashboardService],
})
export class AdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes(AdminController, AdminDashboardController);
  }
}
