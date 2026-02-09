// src/admin/dto/admin.dto.ts
import {
  IsUUID,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsIn,
  IsEmail,
  ValidateIf,
  IsString,
  Length,
  IsArray,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { AgentName } from '@prisma/client';

/** ---------- Helpers ---------- */
const toNumber = ({ value }: { value: any }) => {
  if (value === '' || value === undefined || value === null) return undefined;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isNaN(n) ? undefined : n;
};

const toDate = ({ value }: { value: any }) =>
  value === '' || value === undefined || value === null ? undefined : new Date(value);

/** Accept Date | string | null | undefined; maps '' -> undefined, null -> null */
const toDateOrNull = ({ value }: { value: any }) => {
  if (value === '' || value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
};

/** Coerce "true"/"false"/boolean -> boolean (for querystrings) */
const toBool = ({ value }: { value: any }) => {
  if (typeof value === 'string') return value === 'true';
  return Boolean(value);
};

/* ===========================================================
 * AssignedAgent CRUD (ID-based)
 * =========================================================== */

/** ---------- Simple params ---------- */
export class AssignmentByIdDto {
  @IsUUID()
  id!: string;
}

export class FindUserDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  oauthId?: string;
}

/** ---------- Create / Update AssignedAgent ---------- */
export class CreateAssignedAgentDto {
  @IsUUID()
  userId!: string;

  @IsEnum(AgentName)
  agentName!: AgentName;

  @IsOptional()
  @Type(toDate as any)
  startsAt?: Date;

  @IsOptional()
  @Type(toDate as any)
  expiresAt?: Date;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  durationDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean; // default true in DB
}

export class UpdateAssignedAgentDto {
  @IsUUID()
  id!: string;

  @IsOptional()
  @Type(toDate as any)
  startsAt?: Date;

  // allow null to clear expiry
  @IsOptional()
  @ValidateIf((o) => o.expiresAt !== undefined)
  @Transform(toDateOrNull)
  expiresAt?: Date | null;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  durationDays?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Quick toggle */
export class ToggleAssignmentActiveDto {
  @IsUUID()
  id!: string;

  @IsBoolean()
  isActive!: boolean;
}

/** Extend/shift expiry by N days (can be negative) */
export class ExtendAssignmentDto {
  @IsUUID()
  id!: string;

  @Transform(toNumber)
  @IsInt()
  @Min(-3650)
  @Max(3650)
  addDays!: number;
}

/** ---------- Query / Pagination ---------- */
export class QueryAssignmentsDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  // filters
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  userEmail?: string;

  @IsOptional()
  @IsEnum(AgentName)
  agentName?: AgentName;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  expiredOnly?: boolean;

  // sorting
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'startsAt', 'expiresAt', 'agentName'])
  sortBy?: 'createdAt' | 'updatedAt' | 'startsAt' | 'expiresAt' | 'agentName';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

/** ---------- Bulk ops ---------- */
export class BulkUpsertAssignmentItemDto {
  @IsEnum(AgentName)
  agentName!: AgentName;

  @IsOptional()
  @Type(toDate as any)
  startsAt?: Date;

  @IsOptional()
  @Type(toDate as any)
  expiresAt?: Date;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  durationDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BulkUpsertAssignmentsDto {
  @IsUUID()
  userId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkUpsertAssignmentItemDto)
  items!: BulkUpsertAssignmentItemDto[];
}

/* ===========================================================
 * Agent Groups (admin-defined)
 * =========================================================== */

export class CreateAgentGroupDto {
  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean; // default true in DB
}

export class UpdateAgentGroupDto {
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddAgentsToGroupDto {
  @IsUUID()
  groupId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(AgentName, { each: true })
  agentNames!: AgentName[];
}

export class RemoveAgentsFromGroupDto {
  @IsUUID()
  groupId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(AgentName, { each: true })
  agentNames!: AgentName[];
}

export class ReplaceGroupAgentsDto {
  @IsUUID()
  groupId!: string;

  /** Full replacement; empty array clears the group */
  @IsArray()
  @IsEnum(AgentName, { each: true })
  agentNames!: AgentName[];
}

export class QueryAgentGroupsDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  nameContains?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'name'])
  sortBy?: 'createdAt' | 'updatedAt' | 'name';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

/* ===========================================================
 * Assign groups to user (email-based)
 * =========================================================== */

export class GroupSelectorDto {
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  groupName?: string;
}

export class AssignGroupByEmailDto {
  @IsEmail()
  email!: string;

  @ValidateNested()
  @Type(() => GroupSelectorDto)
  selector!: GroupSelectorDto;

  @IsOptional()
  @Type(toDate as any)
  startsAt?: Date;

  @IsOptional()
  @ValidateIf((o) => o.expiresAt !== undefined)
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
}

export class AssignGroupsByEmailDto {
  @IsEmail()
  email!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GroupSelectorDto)
  selectors!: GroupSelectorDto[];

  @IsOptional()
  @Type(toDate as any)
  startsAt?: Date;

  @IsOptional()
  @ValidateIf((o) => o.expiresAt !== undefined)
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
}

/* ===========================================================
 * Create group WITH agents (+ optional immediate assign)
 * =========================================================== */

export class CreateAgentGroupWithAgentsDto {
  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(AgentName, { each: true })
  agentNames!: AgentName[];
}

export class CreateGroupWithAgentsAndAssignByEmailDto {
  // group definition
  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(AgentName, { each: true })
  agentNames!: AgentName[];

  // target user + assignment options
  @IsEmail()
  email!: string;

  @IsOptional()
  @Type(toDate as any)
  startsAt?: Date;

  @IsOptional()
  @ValidateIf((o) => o.expiresAt !== undefined)
  @Transform(toDateOrNull)
  expiresAt?: Date | null;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  durationDays?: number;

  /** controls assignment isActive (group record remains as created) */
  @IsOptional()
  @IsBoolean()
  isActiveAssignment?: boolean;
}
