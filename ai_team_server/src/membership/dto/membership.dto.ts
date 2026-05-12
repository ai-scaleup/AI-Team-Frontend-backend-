import { AgentName } from 'src/generated/prisma/client';

export class CreateMembershipDto {
  name!: string;
  durationDays!: number;
  monthlyTokenLimit!: number;
  includedAgents?: AgentName[];
  includedGroupIds?: string[];
}

export class AssignMembershipDto {
  userId!: string;
  membershipTemplateId!: string;
  durationOverride?: number;
}
