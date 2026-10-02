import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthMiddleware } from '../auth/auth.middleware';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TokenUsageModule } from 'src/token-usage/token-usage.module';
import { MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';

// Membership tier: MembershipTemplate + AssignedMembership. TokenUsageModule
// owns the usage ledger the admin dashboard reads, so spend recorded on a
// membership's shared pool goes through it as well.
@Module({
  imports: [PrismaModule, TokenUsageModule],
  controllers: [MembershipController],
  providers: [MembershipService],
  exports: [MembershipService],
})
export class MembershipModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(MembershipController);
  }
}
