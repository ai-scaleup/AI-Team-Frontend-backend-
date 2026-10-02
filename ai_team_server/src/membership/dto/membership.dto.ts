import { AgentName } from 'src/generated/prisma/client';

/* -------------------------- Membership templates -------------------------- */

export class CreateMembershipDto {
  name!: string;
  durationDays!: number;
  monthlyTokenLimit!: number;
  /** Single agents bundled into the membership. */
  includedAgents?: AgentName[];
  /** Agent teams bundled into the membership, by AgentTeam id. */
  includedTeamIds?: string[];
}

export class UpdateMembershipDto {
  name?: string;
  durationDays?: number;
  monthlyTokenLimit?: number;
  /** Replaces the single-agent list when present. */
  includedAgents?: AgentName[];
  /**
   * Replaces the team list when present. Omit the field to leave the current
   * teams untouched; an empty array unlinks them all.
   */
  includedTeamIds?: string[];
}

/** Body for the single-agent add endpoint. */
export class AddMembershipAgentsDto {
  agents!: AgentName[];
}

/** Body for the team add endpoint. */
export class AddMembershipTeamsDto {
  teamIds!: string[];
}

/* ------------------------------- Assignment ------------------------------- */

export class AssignMembershipDto {
  userId!: string;
  membershipTemplateId!: string;
  durationOverride?: number;
  /**
   * The SHARED allowance per 30-day cycle for this grant: every agent the
   * membership reaches draws on the same figure. Defaults to the template's.
   */
  monthlyTokenLimitOverride?: number;
}

export class UpdateMembershipAssignmentDto {
  /** New shared allowance; tokensLeft is re-priced against spend so far. */
  monthlyTokenLimit?: number;
  startsAt?: string | Date;
  /** Explicit expiry (null clears it). Wins over durationDays. */
  expiresAt?: string | Date | null;
  /** Counted from startsAt (the new one if given, else the grant's). */
  durationDays?: number;
  isActive?: boolean;
}

/**
 * Body for the shared-pool usage endpoint. `agentName` says which of the
 * membership's agents was chatting; the spend lands on the one pool.
 */
export class RecordMembershipTokenUsageDto {
  agentName!: AgentName;
  /** Signed delta: positive spends, negative refunds. */
  inputTokens!: number;
  /** Signed delta: positive spends, negative refunds. */
  outputTokens!: number;
}

/**
 * Body for the email-addressed usage endpoint: the grant is found from the
 * user's email and the membership (template id, or the assignment id).
 */
export class RecordMembershipTokenUsageByEmailDto extends RecordMembershipTokenUsageDto {
  email!: string;
  /** Membership template id (or an assignment id of that user). */
  membershipId!: string;
}
