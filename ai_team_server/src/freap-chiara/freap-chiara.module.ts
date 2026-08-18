import { Module } from '@nestjs/common';
import { FreapChiaraService } from './freap-chiara.service';
import { FreapChiaraController } from './freap-chiara.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FreapChiaraController],
  providers: [FreapChiaraService],
})
export class FreapChiaraModule {}
