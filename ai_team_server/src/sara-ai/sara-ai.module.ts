import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthMiddleware } from '../auth/auth.middleware';
import { SaraAiController } from './controllers/sara-ai.controller';
import { SaraAiService } from './services/sara-ai.service';

@Module({
  imports: [],
  controllers: [SaraAiController],
  providers: [SaraAiService],
  exports: [SaraAiService],
})
export class SaraAiModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(SaraAiController);
  }
}
