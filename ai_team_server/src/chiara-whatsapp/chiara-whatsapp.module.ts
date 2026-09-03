import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { DevTokenMiddleware } from '../auth/dev-token.middleware';
import { ChiaraWhatsappService } from './chiara-whatsapp.service';
import { ChiaraWhatsappController } from './chiara-whatsapp.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ChiaraWhatsappController],
  providers: [ChiaraWhatsappService],
})
export class ChiaraWhatsappModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // The development token is the only credential this group accepts, so it
    // skips the shared AuthMiddleware (see auth/public-routes.ts) and checks
    // the token itself.
    consumer.apply(DevTokenMiddleware).forRoutes(ChiaraWhatsappController);
  }
}
