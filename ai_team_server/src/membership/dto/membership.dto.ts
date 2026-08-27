import { AgentName } from 'src/generated/prisma/client';

export class CreateMembershipDto {
  name!: string;
  durationDays!: number;
  monthlyTokenLimit!: number;
  includedAgents?: AgentName[];
  /** Teams bundled into this membership, by AgentGroup id. */
  includedGroupIds?: string[];
}

export class UpdateMembershipDto {
  name?: string;
  durationDays?: number;
  monthlyTokenLimit?: number;
  includedAgents?: AgentName[];
  /**
   * Replaces the template's team list when supplied. Omit the field to leave
   * the current teams untouched; an empty array unlinks them all. Unlinking is
   * a soft toggle — no MembershipTemplateGroup row is ever deleted.
   */
  includedGroupIds?: string[];
}

export class AssignMembershipDto {
  userId!: string;
  membershipTemplateId!: string;
  durationOverride?: number;
  monthlyTokenLimitOverride?: number;
}
