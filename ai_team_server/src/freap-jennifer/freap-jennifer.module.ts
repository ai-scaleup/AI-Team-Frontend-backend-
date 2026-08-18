import { Module } from '@nestjs/common';
import { FreapJenniferService } from './freap-jennifer.service';
import { FreapJenniferController } from './freap-jennifer.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FreapJenniferController],
  providers: [FreapJenniferService],
})
export class FreapJenniferModule {}
