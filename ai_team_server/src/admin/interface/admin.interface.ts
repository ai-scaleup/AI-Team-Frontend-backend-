// src/admin/interface/admin.interface.ts

/** Mirror of Prisma enum AgentName (30 values, incl. test agents) */
export enum AgentName {
  JIM = 'JIM',
  ALEX = 'ALEX',
  MIKE = 'MIKE',
  TONY = 'TONY',
  LARA = 'LARA',
  VALENTINA = 'VALENTINA',
  DANIELE = 'DANIELE',
  SIMONE = 'SIMONE',
  NIKO = 'NIKO',
  ALADINO = 'ALADINO',
  LAURA = 'LAURA',
  DAN = 'DAN',
  MAX = 'MAX',
  SOFIA = 'SOFIA',
  ROBERTA = 'ROBERTA',
  SARA_AI = 'SARA_AI',
  JENNIFER_AI = 'JENNIFER_AI',
  CHIARA_AI = 'CHIARA_AI',
  FREAP_CHIARA = 'FREAP_CHIARA',
  FREAP_JENNIFER = 'FREAP_JENNIFER',
  PEARL_ADMIN = 'PEARL_ADMIN',

  // --- test agents ---
  TEST_JIM = 'TEST_JIM',
  TEST_ALEX = 'TEST_ALEX',
  TEST_MIKE = 'TEST_MIKE',
  TEST_TONY = 'TEST_TONY',
  TEST_LARA = 'TEST_LARA',
  TEST_VALENTINA = 'TEST_VALENTINA',
  TEST_DANIELE = 'TEST_DANIELE',
  TEST_SIMONE = 'TEST_SIMONE',
  TEST_NIKO = 'TEST_NIKO',
  TEST_ALADINO = 'TEST_ALADINO',
  TEST_LAURA = 'TEST_LAURA',
  TEST_DAN = 'TEST_DAN',
  TEST_MAX = 'TEST_MAX',
  TEST_SOFIA = 'TEST_SOFIA',
  TEST_ROBERTA = 'TEST_ROBERTA',
  TEST_SARA_AI = 'TEST_SARA_AI',
  TEST_JENNIFER_AI = 'TEST_JENNIFER_AI',
  TEST_CHIARA_AI = 'TEST_CHIARA_AI',
}

/** Utility: allow Date or ISO string */
export type Dateish = Date | string;

/* ================================
 * Prisma-like entity shapes
 * ================================ */

export interface IUser {
  id: string;
  email: string;
  oauthId: string;
  username?: string | null;
  createdAt: Dateish;
  updatedAt: Dateish;

  // relations
  agents?: IAssignedAgent[];
  groups?: IAssignedGroup[];
}

export interface IAssignedAgent {
  id: string;
  userId: string;
  agentName: AgentName;

  startsAt: Dateish;
  expiresAt?: Dateish | null;

  durationDays?: number | null;
  isActive: boolean;

  createdAt: Dateish;
  updatedAt: Dateish;

  // relation
  user?: IUser;
}

export interface IAgentGroup {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Dateish;
  updatedAt: Dateish;

  // relations
  items?: IAgentGroupItem[];
  assignments?: IAssignedGroup[];
}

export interface IAgentGroupItem {
  id: string;
  groupId: string;
  agentName: AgentName;
  createdAt: Dateish;
  updatedAt: Dateish;

  // relation
  group?: IAgentGroup;
}

/** Assignment of a whole group to a user */
export interface IAssignedGroup {
  id: string;
  userId: string;
  groupId: string;

  startsAt: Dateish;
  expiresAt?: Dateish | null;

  durationDays?: number | null;
  isActive: boolean;

  createdAt: Dateish;
  updatedAt: Dateish;

  // relations
  user?: IUser;
  group?: IAgentGroup;
}

/* ================================
 * Admin DTO-style contracts
 * (payloads used in service/controller)
 * ================================ */

export interface CreateAssignedAgentPayload {
  userId: string;
  agentName: AgentName;
  startsAt?: Dateish;
  expiresAt?: Dateish; // use null in Update to clear
  durationDays?: number;
  isActive?: boolean; // defaults to true in DB
}

export interface UpdateAssignedAgentPayload {
  id: string;
  startsAt?: Dateish;
  expiresAt?: Dateish | null; // null to clear
  durationDays?: number | null;
  isActive?: boolean;
}

export interface ToggleAssignmentActivePayload {
  id: string;
  isActive: boolean;
}

export interface ExtendAssignmentPayload {
  id: string;
  /** +/- number of days to shift expiry */
  addDays: number;
}

/* ---------- Email-based flows (single/multi agent) ---------- */

export interface AssignSingleByEmailPayload {
  email: string;
  agentName: AgentName;
  startsAt?: Dateish;
  /** explicit null clears expiry */
  expiresAt?: Dateish | null;
  durationDays?: number;
  isActive?: boolean;
}

export interface AssignBulkByEmailPayload {
  email: string;
  agentNames: AgentName[];
  startsAt?: Dateish;
  /** explicit null clears expiry */
  expiresAt?: Dateish | null;
  durationDays?: number;
  isActive?: boolean;
}

export interface DeactivateByEmailPayload {
  email: string;
  agentName: AgentName;
}

export interface ListByEmailQuery {
  email: string;
  activeOnly?: boolean;
}

/* ---------- Agent Group CRUD & membership ---------- */

export interface CreateAgentGroupPayload {
  name: string;
  description?: string;
  isActive?: boolean; // default true
}

export interface UpdateAgentGroupPayload {
  id: string;
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface AddAgentsToGroupPayload {
  groupId: string;
  agentNames: AgentName[];
}

export interface RemoveAgentsFromGroupPayload {
  groupId: string;
  agentNames: AgentName[];
}

export interface ReplaceGroupAgentsPayload {
  groupId: string;
  /** Full replacement; empty array clears the group */
  agentNames: AgentName[];
}

/* ---------- Assign groups to user (email-based) ---------- */

export interface GroupSelectorById {
  groupId: string;
}
export interface GroupSelectorByName {
  groupName: string;
}
export type GroupSelector = GroupSelectorById | GroupSelectorByName;

export interface AssignGroupByEmailPayload {
  email: string;
  selector: GroupSelector; // by id OR by unique name
  startsAt?: Dateish;
  expiresAt?: Dateish | null;
  durationDays?: number;
  isActive?: boolean;
}

export interface AssignGroupsByEmailPayload {
  email: string;
  selectors: GroupSelector[]; // merge & dedupe agents from groups
  startsAt?: Dateish;
  expiresAt?: Dateish | null;
  durationDays?: number;
  isActive?: boolean;
}

/* ---------- Create group WITH agents (+ optional immediate assign) ---------- */

export interface CreateAgentGroupWithAgentsPayload {
  name: string;
  description?: string;
  isActive?: boolean; // default true
  agentNames: AgentName[];
}

export interface CreateGroupWithAgentsAndAssignByEmailPayload
  extends CreateAgentGroupWithAgentsPayload {
  email: string;
  startsAt?: Dateish;
  expiresAt?: Dateish | null;
  durationDays?: number;
  /** controls assignment isActive (group record remains as created) */
  isActiveAssignment?: boolean;
}

/* ================================
 * Query / lookup params
 * ================================ */

export interface AssignmentByIdParam {
  id: string;
}

export interface FindUserParams {
  id?: string;
  email?: string;
  oauthId?: string;
}

export type AssignmentSortField =
  | 'createdAt'
  | 'updatedAt'
  | 'startsAt'
  | 'expiresAt'
  | 'agentName';

export type SortOrder = 'asc' | 'desc';

export interface QueryAssignmentsParams {
  page?: number; // default 1
  limit?: number; // default 20 (max 100)

  // filters
  userId?: string;
  userEmail?: string;
  agentName?: AgentName;
  isActive?: boolean;

  activeOnly?: boolean;
  expiredOnly?: boolean;

  // sorting
  sortBy?: AssignmentSortField;
  sortOrder?: SortOrder;
}

export type AgentGroupSortField = 'createdAt' | 'updatedAt' | 'name';

export interface QueryAgentGroupsParams {
  page?: number; // default 1
  limit?: number; // default 20
  nameContains?: string;
  isActive?: boolean;
  sortBy?: AgentGroupSortField;
  sortOrder?: SortOrder;
}

/* ================================
 * Bulk operations
 * ================================ */

export interface BulkUpsertAssignmentItem {
  agentName: AgentName;
  startsAt?: Dateish;
  expiresAt?: Dateish;
  durationDays?: number;
  isActive?: boolean;
}

export interface BulkUpsertAssignmentsPayload {
  userId: string;
  items: BulkUpsertAssignmentItem[];
}

/* ================================
 * Common utility shapes
 * ================================ */

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
