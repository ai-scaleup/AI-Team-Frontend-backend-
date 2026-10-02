// src/agent-team/dto/team-assignment.dto.ts
import {
  IsBoolean,
  IsDefined,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

const toNumber = ({ value }: { value: any }) => {
  if (value === '' || value === undefined || value === null) return undefined;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isNaN(n) ? undefined : n;
};

const toNumberOrNull = ({ value }: { value: any }) => {
  if (value === '' || value === undefined) return undefined;
  if (value === null) return null;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isNaN(n) ? undefined : n;
};

const toDate = ({ value }: { value: any }) => {
  if (value === '' || value === undefined || value === null) return undefined;
  return new Date(value);
};

const toDateOrNull = ({ value }: { value: any }) => {
  if (value === '' || value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
};

const toBool = ({ value }: { value: any }) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string') return value === 'true';
  return Boolean(value);
};

/* --------------------------------- CREATE --------------------------------- */

/**
 * The user is picked by `email` or `userId`, the team by `teamId` or
 * `teamName`; one of each is required. An explicit `expiresAt` wins over
 * `durationDays`, which is counted from `startsAt` (or now).
 */
export class CreateTeamAssignmentDto {
  @ValidateIf((o) => !o.userId)
  @IsEmail()
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsUUID()
  userId?: string;

  @ValidateIf((o) => !o.teamName)
  @IsUUID()
  teamId?: string;

  @ValidateIf((o) => !o.teamId)
  @IsString()
  teamName?: string;

  @IsOptional()
  @Transform(toDate)
  startsAt?: Date;

  @IsOptional()
  @ValidateIf((o) => o.expiresAt !== null)
  @Transform(toDateOrNull)
  expiresAt?: Date | null;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  durationDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Shared allowance for the whole team. Null/omitted = access only. */
  @IsOptional()
  @ValidateIf((o) => o.tokenLimit !== null)
  @Transform(toNumberOrNull)
  @IsInt()
  @Min(0)
  tokenLimit?: number | null;
}

/* --------------------------------- UPDATE --------------------------------- */

export class UpdateTeamAssignmentDto {
  @IsOptional()
  @Transform(toDate)
  startsAt?: Date;

  @IsOptional()
  @ValidateIf((o) => o.expiresAt !== null)
  @Transform(toDateOrNull)
  expiresAt?: Date | null;

  @IsOptional()
  @ValidateIf((o) => o.durationDays !== null)
  @Transform(toNumberOrNull)
  @IsInt()
  @Min(1)
  durationDays?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Re-derives `tokensLeft` from `usedTokens`; null clears the allowance. */
  @IsOptional()
  @ValidateIf((o) => o.tokenLimit !== null)
  @Transform(toNumberOrNull)
  @IsInt()
  @Min(0)
  tokenLimit?: number | null;
}

/* ------------------------------ TOKEN USAGE ------------------------------ */

/**
 * Body for the per-chat usage endpoint of a team grant. The chat reports its
 * `inputTokens` and `outputTokens`; the spend applied to the agent's row is
 * their sum. Both are deltas: a positive number draws the agent's allowance
 * down, a negative one gives it back (a refund or a correction).
 */
export class RecordTeamAgentTokenUsageDto {
  @IsDefined()
  @Transform(toNumber)
  @IsInt()
  inputTokens!: number;

  @IsDefined()
  @Transform(toNumber)
  @IsInt()
  outputTokens!: number;
}

/* ---------------------------------- LIST ---------------------------------- */

export class ListTeamAssignmentsQuery {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isActive?: boolean;

  /** isActive = true AND not expired. */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  activeOnly?: boolean;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'startsAt', 'expiresAt'])
  sortBy?: 'createdAt' | 'updatedAt' | 'startsAt' | 'expiresAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
