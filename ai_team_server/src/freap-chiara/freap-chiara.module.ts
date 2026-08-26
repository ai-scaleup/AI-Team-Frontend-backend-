import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthMiddleware } from '../auth/auth.middleware';
import { FreapChiaraService } from './freap-chiara.service';
import { FreapChiaraController } from './freap-chiara.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FreapChiaraController],
  providers: [FreapChiaraService],
})
export class FreapChiaraModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(FreapChiaraController);
  }
}
