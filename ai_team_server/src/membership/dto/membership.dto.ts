import { AgentName } from 'src/generated/prisma/client';

export class CreateMembershipDto {
  name!: string;
  durationDays!: number;
  monthlyTokenLimit!: number;
  includedAgents?: AgentName[];
}

export class UpdateMembershipDto {
  name?: string;
  durationDays?: number;
  monthlyTokenLimit?: number;
  includedAgents?: AgentName[];
}

export class AssignMembershipDto {
  userId!: string;
  membershipTemplateId!: string;
  durationOverride?: number;
  monthlyTokenLimitOverride?: number;
}
