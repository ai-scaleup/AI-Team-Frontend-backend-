// src/agent-team/agent-team.module.ts
import { Module } from '@nestjs/common';
import { TokenUsageModule } from 'src/token-usage/token-usage.module';
import { AgentTeamController } from './agent-team.controller';
import { AgentTeamService } from './agent-team.service';
import { TeamAssignmentController } from './team-assignment.controller';
import { TeamAssignmentService } from './team-assignment.service';

// Team-level tier: AgentTeam + AssignedTeam. Deliberately has no dependency
// on SingleAssignedAgentModule or MembershipModule.
//
@Module({
  // PrismaModule is global; re-providing PrismaService here would open a
  // second connection pool. TokenUsageModule owns the usage ledger that the
  // admin dashboard reads, so usage recorded on a team grant goes through it.
  imports: [TokenUsageModule],
  controllers: [AgentTeamController, TeamAssignmentController],
  providers: [AgentTeamService, TeamAssignmentService],
  exports: [AgentTeamService, TeamAssignmentService],
})
export class AgentTeamModule {}
