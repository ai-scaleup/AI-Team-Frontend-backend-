// src/admin/admin.module.ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthMiddleware } from '../auth/auth.middleware';
import { PrismaService } from 'src/prisma/prisma.service';

import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { MembershipModule } from 'src/membership/membership.module';

@Module({
  imports: [MembershipModule],
  controllers: [AdminController, AdminDashboardController],
  providers: [PrismaService, AdminService, AdminDashboardService],
  exports: [AdminService, AdminDashboardService],
})
export class AdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes(AdminController, AdminDashboardController);
  }
}
