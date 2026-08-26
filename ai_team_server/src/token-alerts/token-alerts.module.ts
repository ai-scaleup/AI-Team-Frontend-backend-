import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthMiddleware } from '../auth/auth.middleware';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TokenAlertRuleController } from './controllers/token-alert-rule.controller';
import { TokenAlertRuleService } from './services/token-alert-rule.service';

@Module({
  imports: [PrismaModule],
  controllers: [TokenAlertRuleController],
  providers: [TokenAlertRuleService],
  exports: [TokenAlertRuleService],
})
export class TokenAlertsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(TokenAlertRuleController);
  }
}
