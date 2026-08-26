import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthMiddleware } from '../auth/auth.middleware';
import { PearlAdminAccessGuard } from './pearl-admin-access.guard';
import { PearlAdminController } from './pearl-admin.controller';
import { PearlAdminService } from './pearl-admin.service';

@Module({
  controllers: [PearlAdminController],
  providers: [PearlAdminService, PearlAdminAccessGuard],
})
export class PearlAdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(PearlAdminController);
  }
}
