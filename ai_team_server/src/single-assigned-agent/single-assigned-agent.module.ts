// src/single-assigned-agent/single-assigned-agent.module.ts
import { Module } from '@nestjs/common';
import { LlmModelModule } from 'src/llm-model/llm-model.module';
import { TokenUsageModule } from 'src/token-usage/token-usage.module';
import { SingleAssignedAgentController } from './single-assigned-agent.controller';
import { SingleAssignedAgentService } from './single-assigned-agent.service';

@Module({
  // PrismaModule is global; re-providing PrismaService here would open a
  // second connection pool. TokenUsageModule owns the usage ledger that the
  // admin dashboard reads, so usage recorded here goes through it.
  // LlmModelModule validates the grant's chat model.
  imports: [TokenUsageModule, LlmModelModule],
  controllers: [SingleAssignedAgentController],
  providers: [SingleAssignedAgentService],
  exports: [SingleAssignedAgentService],
})
export class SingleAssignedAgentModule {}
