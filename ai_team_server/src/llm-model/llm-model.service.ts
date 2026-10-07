// src/llm-model/llm-model.service.ts
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { AgentName, LlmModel, Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

/** What the admin panel and the team views show for a model. */
export type LlmModelView = {
  id: string;
  provider: string;
  /** Exact id the provider's API expects, e.g. "claude-sonnet-5". */
  modelId: string;
  label: string;
  isDefault: boolean;
  isActive: boolean;
};

/** Which model a chat runs on, and the grant that decided it. */
export type ResolvedModel = {
  model: LlmModelView;
  /** The tier whose own choice applies; 'default' = the catalog default. */
  source: 'single-agent' | 'team' | 'membership' | 'default';
  teamId: string | null;
  membershipAssignmentId: string | null;
  singleAssignmentId: string | null;
};

export function toLlmModelView(row: LlmModel): LlmModelView {
  return {
    id: row.id,
    provider: row.provider,
    modelId: row.modelId,
    label: row.label,
    isDefault: row.isDefault,
    isActive: row.isActive,
  };
}

/**
 * Read side of the LlmModel catalog. Rows are seeded by migration and never
 * deleted here, so a team's stored choice always resolves.
 */
@Injectable()
export class LlmModelService {
  constructor(private readonly prisma: PrismaService) {}

  /** Models an admin can pick, in display order. */
  async findAll(opts: { provider?: string; includeInactive?: boolean } = {}) {
    const rows = await this.prisma.llmModel.findMany({
      where: {
        ...(opts.provider ? { provider: opts.provider } : {}),
        ...(opts.includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
    return rows.map(toLlmModelView);
  }

  /** The model a team without its own choice runs on. */
  async getDefault(): Promise<LlmModel> {
    const row = await this.prisma.llmModel.findFirst({
      where: { isDefault: true, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    if (!row) {
      throw new InternalServerErrorException(
        'No default chat model is configured (LlmModel.isDefault)',
      );
    }
    return row;
  }

  /**
   * The model a user's chat with `agentName` runs on.
   *
   * The grant that pays for the chat decides, as the chat page resolved it:
   * a single-agent grant (`singleAssignmentId`), a membership
   * (`membershipAssignmentId`) or a team (`teamId`). It counts only when it
   * is the user's own live grant and reaches the agent. Without a paying
   * grant, the user's grants are tried in the same order the chat page tries
   * tiers for tokens -- single agent, then team, then membership, newest
   * first within each -- and the first one found decides, so an access-only
   * grant still sets the model. A grant without its own choice gets the
   * catalog default, and so does a grant whose model was deactivated rather
   * than failing.
   */
  async resolveForAgent(sel: {
    email: string;
    agentName: AgentName;
    teamId?: string;
    membershipAssignmentId?: string;
    singleAssignmentId?: string;
  }): Promise<ResolvedModel> {
    const now = new Date();
    const live = {
      user: { email: sel.email },
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };

    const singleWhere = {
      ...live,
      agentName: sel.agentName,
    } satisfies Prisma.SingleAssignedAgentWhereInput;
    const teamWhere = {
      ...live,
      team: {
        isActive: true,
        agents: { some: { agentName: sel.agentName } },
      },
    } satisfies Prisma.AssignedTeamWhereInput;
    const membershipWhere = {
      ...live,
      // Same reach as resolveTemplateAgents: single agents plus the agents
      // of the membership's active teams.
      template: {
        OR: [
          { includedAgents: { has: sel.agentName } },
          {
            includedTeams: {
              some: {
                team: {
                  isActive: true,
                  agents: { some: { agentName: sel.agentName } },
                },
              },
            },
          },
        ],
      },
    } satisfies Prisma.AssignedMembershipWhereInput;

    const findSingle = (id?: string) =>
      this.prisma.singleAssignedAgent.findFirst({
        where: { ...singleWhere, ...(id ? { id } : {}) },
        orderBy: { createdAt: 'desc' },
        select: { id: true, llmModel: true },
      });
    const findTeam = (teamId?: string) =>
      this.prisma.assignedTeam.findFirst({
        where: { ...teamWhere, ...(teamId ? { teamId } : {}) },
        orderBy: { createdAt: 'desc' },
        select: { teamId: true, team: { select: { llmModel: true } } },
      });
    const findMembership = (id?: string) =>
      this.prisma.assignedMembership.findFirst({
        where: { ...membershipWhere, ...(id ? { id } : {}) },
        orderBy: { createdAt: 'desc' },
        select: { id: true, template: { select: { llmModel: true } } },
      });

    const decide = async (
      tier: 'single-agent' | 'team' | 'membership',
      own: LlmModel | null,
      ids: Partial<
        Pick<
          ResolvedModel,
          'teamId' | 'membershipAssignmentId' | 'singleAssignmentId'
        >
      >,
    ): Promise<ResolvedModel> => ({
      model: toLlmModelView(own?.isActive ? own : await this.getDefault()),
      source: own?.isActive ? tier : 'default',
      teamId: null,
      membershipAssignmentId: null,
      singleAssignmentId: null,
      ...ids,
    });
    const fromSingle = (g: { id: string; llmModel: LlmModel | null }) =>
      decide('single-agent', g.llmModel, { singleAssignmentId: g.id });
    const fromTeam = (g: {
      teamId: string;
      team: { llmModel: LlmModel | null };
    }) => decide('team', g.team.llmModel, { teamId: g.teamId });
    const fromMembership = (g: {
      id: string;
      template: { llmModel: LlmModel | null };
    }) =>
      decide('membership', g.template.llmModel, {
        membershipAssignmentId: g.id,
      });

    // The paying grant, when the page named one the user really holds.
    if (sel.singleAssignmentId) {
      const paying = await findSingle(sel.singleAssignmentId);
      if (paying) return fromSingle(paying);
    }
    if (sel.membershipAssignmentId) {
      const paying = await findMembership(sel.membershipAssignmentId);
      if (paying) return fromMembership(paying);
    }
    if (sel.teamId) {
      const paying = await findTeam(sel.teamId);
      if (paying) return fromTeam(paying);
    }

    // Otherwise the first grant in tier order.
    const single = await findSingle();
    if (single) return fromSingle(single);
    const team = await findTeam();
    if (team) return fromTeam(team);
    const membership = await findMembership();
    if (membership) return fromMembership(membership);

    return {
      model: toLlmModelView(await this.getDefault()),
      source: 'default',
      teamId: null,
      membershipAssignmentId: null,
      singleAssignmentId: null,
    };
  }

  /** Rejects an id that is unknown or deactivated before it is stored. */
  async assertSelectable(id: string): Promise<LlmModel> {
    const row = await this.prisma.llmModel.findUnique({ where: { id } });
    if (!row || !row.isActive) {
      throw new BadRequestException(`Unknown or inactive model "${id}"`);
    }
    return row;
  }
}
