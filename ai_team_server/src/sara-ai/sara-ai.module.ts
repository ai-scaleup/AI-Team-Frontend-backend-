import { Module } from '@nestjs/common';
import { SaraAiController } from './controllers/sara-ai.controller';
import { SaraAiService } from './services/sara-ai.service';

@Module({
  imports: [],
  controllers: [SaraAiController],
  providers: [SaraAiService],
  exports: [SaraAiService],
})
export class SaraAiModule {}
