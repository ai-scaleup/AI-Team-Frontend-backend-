// src/agent-team/dto/agent-team.dto.ts
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AgentName } from 'src/generated/prisma/client';

const toNumber = ({ value }: { value: any }) => {
  if (value === '' || value === undefined || value === null) return undefined;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isNaN(n) ? undefined : n;
};

const toBool = ({ value }: { value: any }) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string') return value === 'true';
  return Boolean(value);
};

/** Allows number | null | undefined; maps '' -> undefined, null -> null */
const toNumberOrNull = ({ value }: { value: any }) => {
  if (value === '' || value === undefined) return undefined;
  if (value === null) return null;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isNaN(n) ? undefined : n;
};

const trim = ({ value }: { value: any }) =>
  typeof value === 'string' ? value.trim() : value;

/* --------------------------------- CREATE --------------------------------- */

export class CreateAgentTeamDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description!: string;

  /** Optional; omit or send [] to create an empty team. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(AgentName, { each: true })
  agents?: AgentName[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * Default token allowance for the team; seeds each user's AssignedTeam grant
   * when the team is assigned. Null/omitted = access only.
   */
  @IsOptional()
  @ValidateIf((o) => o.tokenLimit !== null)
  @Transform(toNumberOrNull)
  @IsInt()
  @Min(0)
  tokenLimit?: number | null;
}

/* --------------------------------- UPDATE --------------------------------- */

export class UpdateAgentTeamDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description?: string;

  /** Replaces the whole agent list when present. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(AgentName, { each: true })
  agents?: AgentName[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Null clears the allowance so the team is access only. */
  @IsOptional()
  @ValidateIf((o) => o.tokenLimit !== null)
  @Transform(toNumberOrNull)
  @IsInt()
  @Min(0)
  tokenLimit?: number | null;
}

/* ---------------------------------- LIST ---------------------------------- */

export class ListAgentTeamsQuery {
  /** Case-insensitive match on name. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  search?: string;

  /** Only teams that contain this agent. */
  @IsOptional()
  @IsEnum(AgentName)
  agentName?: AgentName;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isActive?: boolean;

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
  @IsIn(['createdAt', 'updatedAt', 'name'])
  sortBy?: 'createdAt' | 'updatedAt' | 'name';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
