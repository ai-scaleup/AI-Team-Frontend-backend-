import { Module } from '@nestjs/common';
import { JenniferService } from './jennifer.service';
import { JenniferController } from './jennifer.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [JenniferController],
  providers: [JenniferService],
})
export class JenniferModule {}
