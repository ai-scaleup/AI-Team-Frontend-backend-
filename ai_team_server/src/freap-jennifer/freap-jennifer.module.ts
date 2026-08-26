import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthMiddleware } from '../auth/auth.middleware';
import { FreapJenniferService } from './freap-jennifer.service';
import { FreapJenniferController } from './freap-jennifer.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FreapJenniferController],
  providers: [FreapJenniferService],
})
export class FreapJenniferModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(FreapJenniferController);
  }
}
