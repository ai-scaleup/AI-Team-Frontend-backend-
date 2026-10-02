// src/agent-team/agent-team.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AgentName, Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { syncAssignedTeamAgents } from './assigned-team-agent.helpers';
import {
  CreateAgentTeamDto,
  ListAgentTeamsQuery,
  UpdateAgentTeamDto,
} from './dto/agent-team.dto';

type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const teamInclude = {
  agents: { select: { agentName: true }, orderBy: { createdAt: 'asc' } },
  _count: { select: { assignments: true } },
} satisfies Prisma.AgentTeamInclude;

type TeamRow = Prisma.AgentTeamGetPayload<{ include: typeof teamInclude }>;

/** Flattened shape returned by every endpoint. */
export type AgentTeamView = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  /** Default per-agent allowance seeded onto each assignment; null = access only. */
  tokenLimit: number | null;
  agents: AgentName[];
  agentCount: number;
  assignmentCount: number;
  createdAt: Date;
  updatedAt: Date;
};

function toView(row: TeamRow): AgentTeamView {
  const agents = row.agents.map((a) => a.agentName);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    tokenLimit: row.tokenLimit,
    agents,
    agentCount: agents.length,
    assignmentCount: row._count.assignments,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * The ONLY writer of AgentTeam / AgentTeamAgent rows. This tier is
 * independent of SingleAssignedAgent and of memberships: nothing here reads
 * or writes those tables.
 */
@Injectable()
export class AgentTeamService {
  constructor(private readonly prisma: PrismaService) {}

  /* ------------------------------- helpers ------------------------------- */

  private async getOrThrow(id: string): Promise<TeamRow> {
    if (!id?.trim()) throw new BadRequestException('Team id is required');
    const row = await this.prisma.agentTeam.findUnique({
      where: { id },
      include: teamInclude,
    });
    if (!row) throw new NotFoundException(`Team "${id}" not found`);
    return row;
  }

  private async assertNameFree(name: string, exceptId?: string) {
    const clash = await this.prisma.agentTeam.findFirst({
      where: { name, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(`A team named "${name}" already exists`);
    }
  }

  /** Resolves a team by id or (exact) name for the assignment path. */
  async resolveTeam(sel: { teamId?: string; teamName?: string }) {
    if (sel.teamId) {
      const team = await this.prisma.agentTeam.findUnique({
        where: { id: sel.teamId },
      });
      if (!team) throw new NotFoundException(`Team "${sel.teamId}" not found`);
      return team;
    }
    const name = sel.teamName?.trim();
    if (!name) throw new BadRequestException('teamId or teamName is required');
    const team = await this.prisma.agentTeam.findUnique({ where: { name } });
    if (!team) throw new NotFoundException(`Team named "${name}" not found`);
    return team;
  }

  /* -------------------------------- CREATE -------------------------------- */

  async create(dto: CreateAgentTeamDto): Promise<AgentTeamView> {
    await this.assertNameFree(dto.name);
    const agents = dto.agents ?? [];

    const row = await this.prisma.agentTeam.create({
      data: {
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive ?? true,
        tokenLimit: dto.tokenLimit ?? null,
        agents: { create: agents.map((agentName) => ({ agentName })) },
      },
      include: teamInclude,
    });
    return toView(row);
  }

  /* --------------------------------- READ --------------------------------- */

  async findAll(q: ListAgentTeamsQuery): Promise<Paginated<AgentTeamView>> {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;

    const where: Prisma.AgentTeamWhereInput = {
      ...(q.search
        ? { name: { contains: q.search, mode: 'insensitive' } }
        : {}),
      ...(q.agentName ? { agents: { some: { agentName: q.agentName } } } : {}),
      ...(typeof q.isActive === 'boolean' ? { isActive: q.isActive } : {}),
    };

    // These are independent reads. Avoid a batch transaction here because the
    // runtime pool can intentionally be limited to one connection; concurrent
    // list requests would otherwise fail with P2028 while waiting to begin a
    // transaction. The adapter will queue the ordinary queries safely.
    const [rows, total] = await Promise.all([
      this.prisma.agentTeam.findMany({
        where,
        include: teamInclude,
        orderBy: { [q.sortBy ?? 'createdAt']: q.sortOrder ?? 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.agentTeam.count({ where }),
    ]);

    return {
      data: rows.map(toView),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findOne(id: string): Promise<AgentTeamView> {
    return toView(await this.getOrThrow(id));
  }

  /* -------------------------------- UPDATE -------------------------------- */

  /** `agents`, when present, replaces the whole list. */
  async update(id: string, dto: UpdateAgentTeamDto): Promise<AgentTeamView> {
    const existing = await this.getOrThrow(id);
    if (dto.name !== undefined && dto.name !== existing.name) {
      await this.assertNameFree(dto.name, id);
    }

    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.agents !== undefined) {
        await tx.agentTeamAgent.deleteMany({ where: { teamId: id } });
        if (dto.agents.length) {
          await tx.agentTeamAgent.createMany({
            data: dto.agents.map((agentName) => ({ teamId: id, agentName })),
          });
        }
        // Users already holding this team follow the new roster: a newly
        // added agent gets its per-agent allowance, a removed one loses it.
        await syncAssignedTeamAgents(tx, id, dto.agents);
      }
      return tx.agentTeam.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(typeof dto.isActive === 'boolean'
            ? { isActive: dto.isActive }
            : {}),
          ...(dto.tokenLimit !== undefined
            ? { tokenLimit: dto.tokenLimit }
            : {}),
        },
        include: teamInclude,
      });
    });
    return toView(row);
  }

  /* -------------------------------- DELETE -------------------------------- */

  /** Cascades to AgentTeamAgent and AssignedTeam rows. */
  async remove(id: string): Promise<{ deleted: true; id: string }> {
    await this.getOrThrow(id);
    await this.prisma.agentTeam.delete({ where: { id } });
    return { deleted: true, id };
  }
}
