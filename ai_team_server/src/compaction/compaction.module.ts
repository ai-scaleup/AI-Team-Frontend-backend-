import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CompactionAdminController } from './controllers/compaction-admin.controller';
import { CompactionController } from './controllers/compaction.controller';
import { CompactionSettingsService } from './services/compaction-settings.service';
import { CompactionService } from './services/compaction.service';

@Module({
  imports: [PrismaModule],
  controllers: [CompactionAdminController, CompactionController],
  providers: [CompactionSettingsService, CompactionService],
  exports: [CompactionSettingsService, CompactionService],
})
export class CompactionModule {}
