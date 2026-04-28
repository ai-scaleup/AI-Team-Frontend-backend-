import { Module } from '@nestjs/common';
import { TokenUsageController } from './controllers/token-usage.controller';
import { TokenUsageService } from './services/token-usage.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TokenUsageController],
  providers: [TokenUsageService],
  exports: [TokenUsageService],
})
export class TokenUsageModule {}


