// src/admin/schema/admin.schema.ts
import { z } from 'zod';

/** ===== Prisma enum mirror (24 agenti, incl. test) ===== */
export const AgentNameEnum = z.enum([
  'JIM',
  'ALEX',
  'MIKE',
  'TONY',
  'LARA',
  'VALENTINA',
  'DANIELE',
  'SIMONE',
  'NIKO',
  'ALADINO',
  'LAURA',
  'DAN',
  'MAX',
  'SOFIA',
  'ROBERTA',
  'SARA_AI',
  'JENNIFER_AI',
  'CHIARA_AI',
  'FREAP_CHIARA',
  'FREAP_JENNIFER',
  'PEARL_ADMIN',

  // --- test agents ---
  'TEST_JIM',
  'TEST_ALEX',
  'TEST_MIKE',
  'TEST_TONY',
  'TEST_LARA',
  'TEST_VALENTINA',
  'TEST_DANIELE',
  'TEST_SIMONE',
  'TEST_NIKO',
  'TEST_ALADINO',
  'TEST_LAURA',
  'TEST_DAN',
  'TEST_MAX',
  'TEST_SOFIA',
  'TEST_ROBERTA',
  'TEST_SARA_AI',
  'TEST_JENNIFER_AI',
  'TEST_CHIARA_AI',
]);

/** ===== Helpers ===== */
const UUID = z.string().uuid();
const Email = z.string().email();
const Bool = z.boolean();
const PositiveInt = z.number().int().positive();

/** Coerce Date | string -> Date; "" -> undefined; also reject invalid dates */
const CoercedDate = z.preprocess(
  (v) => {
    if (typeof v === 'string' && v.trim() === '') return undefined;
    if (typeof v === 'string' || v instanceof Date) return new Date(v as any);
    return v;
  },
  z
    .date()
    .refine((d) => !Number.isNaN(d.getTime()), { message: 'Invalid date' }),
);

/** Coerce Date | string | null -> Date|null; "" -> undefined; null -> null */
const CoercedDateOrNull = z.preprocess(
  (v) => {
    if (v === null) return null;
    if (typeof v === 'string' && v.trim() === '') return undefined;
    if (typeof v === 'string' || v instanceof Date) return new Date(v as any);
    return v;
  },
  z
    .date()
    .nullable()
    .refine((d) => d === null || !Number.isNaN(d.getTime()), {
      message: 'Invalid date',
    }),
);

/** Accept number|string for ints (e.g., from forms) */
const CoercedPositiveInt = z.preprocess((v) => {
  if (typeof v === 'string' && v.trim() === '') return undefined;
  if (typeof v === 'string') return Number(v);
  return v;
}, PositiveInt);

/** Coerce "true"/"false"/boolean -> boolean (for querystrings) */
const BoolFromQuery = z.preprocess((v) => {
  if (typeof v === 'string') return v === 'true';
  return v;
}, z.boolean());

/* ===========================================================
 * AssignedAgent CRUD (ID-based, for internal/admin backoffice)
 * =========================================================== */

export const CreateAssignedAgentSchema = z.object({
  userId: UUID,
  agentName: AgentNameEnum,
  startsAt: CoercedDate.optional(), // DB defaults now()
  expiresAt: CoercedDate.optional(), // OR use durationDays
  durationDays: CoercedPositiveInt.optional(),
  isActive: Bool.optional(), // DB defaults true
});

export const UpdateAssignedAgentSchema = z.object({
  id: UUID,
  startsAt: CoercedDate.optional(),
  expiresAt: CoercedDateOrNull.optional(), // allow clearing with null
  durationDays: z
    .preprocess((v) => (v === null ? undefined : v), CoercedPositiveInt)
    .nullable()
    .optional(),
  isActive: Bool.optional(),
});

export const ToggleAssignmentActiveSchema = z.object({
  id: UUID,
  isActive: Bool,
});

export const ExtendAssignmentSchema = z.object({
  id: UUID,
  addDays: z
    .preprocess(
      (v) => (typeof v === 'string' ? Number(v) : v),
      z.number().int(),
    )
    .refine((n) => Math.abs(n) <= 3650, {
      message: 'addDays must be within ±3650',
    }),
});

/** Lookups */
export const AssignmentByIdSchema = z.object({ id: UUID });

export const FindUserSchema = z
  .object({
    id: UUID.optional(),
    email: Email.optional(),
    oauthId: z.string().min(1).optional(),
  })
  .refine((o) => !!(o.id || o.email || o.oauthId), {
    message: 'Provide at least one of id | email | oauthId',
    path: ['id'],
  });

export const QueryAssignmentsSchema = z
  .object({
    page: z
      .preprocess(
        (v) => (typeof v === 'string' ? Number(v) : v),
        z.number().int().min(1),
      )
      .default(1),
    limit: z
      .preprocess(
        (v) => (typeof v === 'string' ? Number(v) : v),
        z.number().int().min(1).max(100),
      )
      .default(20),

    userId: UUID.optional(),
    userEmail: z.string().trim().min(1).optional(),
    agentName: AgentNameEnum.optional(),
    isActive: Bool.optional(),

    activeOnly: Bool.optional(),
    expiredOnly: Bool.optional(),

    sortBy: z
      .enum(['createdAt', 'updatedAt', 'startsAt', 'expiresAt', 'agentName'])
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine((o) => !(o.activeOnly && o.expiredOnly), {
    message: 'activeOnly and expiredOnly cannot both be true',
    path: ['activeOnly'],
  });

export const BulkUpsertAssignmentsSchema = z.object({
  userId: UUID,
  items: z
    .array(
      z.object({
        agentName: AgentNameEnum,
        startsAt: CoercedDate.optional(),
        expiresAt: CoercedDate.optional(),
        durationDays: CoercedPositiveInt.optional(),
        isActive: Bool.optional(),
      }),
    )
    .min(1),
});

/* ===========================================================
 * Agent Groups (admin-defined groups of AgentName)
 * =========================================================== */

export const CreateAgentGroupSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  isActive: Bool.optional(),
});

export const UpdateAgentGroupSchema = z.object({
  id: UUID,
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  isActive: Bool.optional(),
});

export const AddAgentsToGroupSchema = z.object({
  groupId: UUID,
  agentNames: z.array(AgentNameEnum).min(1),
});

export const RemoveAgentsFromGroupSchema = z.object({
  groupId: UUID,
  agentNames: z.array(AgentNameEnum).min(1),
});

export const ReplaceGroupAgentsSchema = z.object({
  groupId: UUID,
  agentNames: z.array(AgentNameEnum).min(0), // allow empty to clear
});

export const QueryAgentGroupsSchema = z.object({
  page: z
    .preprocess(
      (v) => (typeof v === 'string' ? Number(v) : v),
      z.number().int().min(1),
    )
    .default(1),
  limit: z
    .preprocess(
      (v) => (typeof v === 'string' ? Number(v) : v),
      z.number().int().min(1).max(100),
    )
    .default(20),
  nameContains: z.string().trim().optional(),
  isActive: BoolFromQuery.optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/** Group selector (by id OR by unique name) */
export const GroupSelectorSchema = z
  .object({
    groupId: UUID.optional(),
    groupName: z.string().trim().min(1).optional(),
  })
  .refine((o) => !!(o.groupId || o.groupName), {
    message: 'Provide groupId or groupName',
    path: ['groupId'],
  });

/** Assign all agents from ONE group to a user (by email) */
export const AssignGroupByEmailSchema = z.object({
  email: Email,
  selector: GroupSelectorSchema,
  startsAt: CoercedDate.optional(),
  expiresAt: CoercedDateOrNull.optional(),
  durationDays: CoercedPositiveInt.optional(),
  isActive: Bool.optional(),
});

/** Assign all agents from MULTIPLE groups to a user (by email) */
export const AssignGroupsByEmailSchema = z.object({
  email: Email,
  selectors: z.array(GroupSelectorSchema).min(1),
  startsAt: CoercedDate.optional(),
  expiresAt: CoercedDateOrNull.optional(),
  durationDays: CoercedPositiveInt.optional(),
  isActive: Bool.optional(),
});

/* ===========================================================
 * NEW: Create group WITH agents (+ optional immediate assign)
 * =========================================================== */

/** Create a group together with its members in one step */
export const CreateAgentGroupWithAgentsSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  isActive: Bool.optional(),
  agentNames: z.array(AgentNameEnum).min(1),
});

/** Create a group with agents and immediately assign the group to a user by email */
export const CreateGroupWithAgentsAndAssignByEmailSchema = z.object({
  // group definition
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  isActive: Bool.optional(),
  agentNames: z.array(AgentNameEnum).min(1),

  // target user + assignment options
  email: Email,
  startsAt: CoercedDate.optional(),
  expiresAt: CoercedDateOrNull.optional(),
  durationDays: CoercedPositiveInt.optional(),
  isActiveAssignment: Bool.optional(),
});

/* ===========================================================
 * Types
 * =========================================================== */
export type CreateAssignedAgentDto = z.infer<typeof CreateAssignedAgentSchema>;
export type UpdateAssignedAgentDto = z.infer<typeof UpdateAssignedAgentSchema>;
export type ToggleAssignmentActiveDto = z.infer<
  typeof ToggleAssignmentActiveSchema
>;
export type ExtendAssignmentDto = z.infer<typeof ExtendAssignmentSchema>;
export type QueryAssignmentsDto = z.infer<typeof QueryAssignmentsSchema>;
export type BulkUpsertAssignmentsDto = z.infer<
  typeof BulkUpsertAssignmentsSchema
>;
export type FindUserDto = z.infer<typeof FindUserSchema>;
export type AssignmentByIdDto = z.infer<typeof AssignmentByIdSchema>;

export type CreateAgentGroupDto = z.infer<typeof CreateAgentGroupSchema>;
export type UpdateAgentGroupDto = z.infer<typeof UpdateAgentGroupSchema>;
export type AddAgentsToGroupDto = z.infer<typeof AddAgentsToGroupSchema>;
export type RemoveAgentsFromGroupDto = z.infer<
  typeof RemoveAgentsFromGroupSchema
>;
export type ReplaceGroupAgentsDto = z.infer<typeof ReplaceGroupAgentsSchema>;
export type QueryAgentGroupsDto = z.infer<typeof QueryAgentGroupsSchema>;

export type GroupSelectorDto = z.infer<typeof GroupSelectorSchema>;
export type AssignGroupByEmailDto = z.infer<typeof AssignGroupByEmailSchema>;
export type AssignGroupsByEmailDto = z.infer<typeof AssignGroupsByEmailSchema>;

export type CreateAgentGroupWithAgentsDto = z.infer<
  typeof CreateAgentGroupWithAgentsSchema
>;
export type CreateGroupWithAgentsAndAssignByEmailDto = z.infer<
  typeof CreateGroupWithAgentsAndAssignByEmailSchema
>;
