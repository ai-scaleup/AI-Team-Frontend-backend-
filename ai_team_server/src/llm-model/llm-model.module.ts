// src/llm-model/llm-model.module.ts
import { Module } from '@nestjs/common';
import { LlmModelController } from './llm-model.controller';
import { LlmModelService } from './llm-model.service';

// Chat model catalog. PrismaModule is global, so nothing to import.
@Module({
  controllers: [LlmModelController],
  providers: [LlmModelService],
  exports: [LlmModelService],
})
export class LlmModelModule {}
