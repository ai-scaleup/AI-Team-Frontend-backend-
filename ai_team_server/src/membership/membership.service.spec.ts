import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  MembershipService,
  membershipTemplateInclude,
  resolveTemplateAgents,
} from './membership.service';

describe('MembershipService', () => {
  // Only the membership tier's own tables are mocked: the service must never
  // write SingleAssignedAgent, AgentTeam or AssignedTeam. AgentTeam is only
  // read, to validate the ids a template links to.
  const prisma = {
    $transaction: jest.fn(),
    membershipTemplate: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    agentTeam: {
      findMany: jest.fn(),
    },
    membershipTemplateTeam: {
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      createMany: jest.fn(),
    },
    assignedMembership: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    // The ledger the shared pool is summed from.
    dailyTokenUsage: {
      findMany: jest.fn(),
    },
  };

  // The ledger the membership tier mirrors pool spend into.
  const tokenUsage = {
    applyAgentTokenDelta: jest.fn(),
  };

  const teamLink = (id: string, agents: string[] = [], isActive = true) => ({
    team: {
      id,
      name: id,
      description: '',
      agents: agents.map((agentName) => ({ agentName })),
      isActive,
    },
  });

  const baseRow = {
    id: 'membership-template-1',
    name: 'Pro',
    durationDays: 30,
    monthlyTokenLimit: 100000,
    includedAgents: ['JIM'],
    includedTeams: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  let service: MembershipService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    prisma.$transaction.mockImplementation(async (arg: any) =>
      typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
    );
    prisma.agentTeam.findMany.mockResolvedValue([]);
    prisma.membershipTemplateTeam.deleteMany.mockResolvedValue({ count: 0 });
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.dailyTokenUsage.findMany.mockResolvedValue([]);
    tokenUsage.applyAgentTokenDelta.mockResolvedValue(undefined);
    service = new MembershipService(prisma as any, tokenUsage as any);
  });

  // A grant row as Prisma returns it with assignmentInclude.
  const assignmentRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'assigned-membership-1',
    userId: 'user-1',
    membershipTemplateId: 'membership-template-1',
    startsAt: new Date('2026-05-01T00:00:00.000Z'),
    expiresAt: new Date('2026-08-01T00:00:00.000Z'),
    isActive: true,
    monthlyTokenLimit: null,
    cycleStartsAt: new Date('2026-05-01T00:00:00.000Z'),
    usedTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    tokensLeft: 100000,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    user: {
      id: 'user-1',
      email: 'u@example.com',
      oauthId: 'oauth-1',
      username: null,
    },
    template: {
      id: 'membership-template-1',
      name: 'Pro',
      monthlyTokenLimit: 100000,
      includedAgents: ['ALEX'],
      includedTeams: [teamLink('t1', ['LARA'])],
    },
    ...overrides,
  });

  describe('resolveTemplateAgents', () => {
    it('unions single agents with active team agents, skipping inactive teams', () => {
      expect(
        resolveTemplateAgents({
          includedAgents: ['JIM'] as any,
          includedTeams: [
            teamLink('t1', ['JIM', 'SARA_AI']),
            teamLink('t2', ['TONY'], false),
          ] as any,
        }),
      ).toEqual(['JIM', 'SARA_AI']);
    });
  });

  it('creates a membership template with single agents and teams', async () => {
    prisma.agentTeam.findMany.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);
    prisma.membershipTemplate.create.mockResolvedValue({
      ...baseRow,
      includedAgents: ['JIM', 'SARA_AI'],
      includedTeams: [teamLink('t1', ['TONY']), teamLink('t2', ['LARA'])],
    });

    const result = await service.createMembership({
      name: 'Pro',
      durationDays: 30,
      monthlyTokenLimit: 100000,
      includedAgents: ['JIM', 'SARA_AI', 'JIM'] as any,
      includedTeamIds: ['t1', 't2', 't1'],
    });

    expect(prisma.membershipTemplate.create).toHaveBeenCalledWith({
      data: {
        name: 'Pro',
        durationDays: 30,
        monthlyTokenLimit: 100000,
        // Duplicates collapse in both lists.
        includedAgents: ['JIM', 'SARA_AI'],
        includedTeams: {
          create: [{ teamId: 't1' }, { teamId: 't2' }],
        },
      },
      include: membershipTemplateInclude,
    });
    expect(result.includedAgents).toEqual(['JIM', 'SARA_AI']);
    expect(result.includedTeamIds).toEqual(['t1', 't2']);
    expect(result.effectiveAgents).toEqual(['JIM', 'SARA_AI', 'TONY', 'LARA']);
  });

  it('creates a membership template with no agents or teams by default', async () => {
    prisma.membershipTemplate.create.mockResolvedValue({
      ...baseRow,
      includedAgents: [],
    });

    await service.createMembership({
      name: 'Empty Plan',
      durationDays: 7,
      monthlyTokenLimit: 5000,
    });

    expect(prisma.membershipTemplate.create).toHaveBeenCalledWith({
      data: {
        name: 'Empty Plan',
        durationDays: 7,
        monthlyTokenLimit: 5000,
        includedAgents: [],
      },
      include: membershipTemplateInclude,
    });
  });

  it('rejects unknown agent team ids on create', async () => {
    prisma.agentTeam.findMany.mockResolvedValue([{ id: 't1' }]);

    await expect(
      service.createMembership({
        name: 'Pro',
        durationDays: 30,
        monthlyTokenLimit: 1,
        includedTeamIds: ['t1', 'missing'],
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.membershipTemplate.create).not.toHaveBeenCalled();
  });

  it('rejects unknown agent names', async () => {
    await expect(
      service.createMembership({
        name: 'Pro',
        durationDays: 30,
        monthlyTokenLimit: 1,
        includedAgents: ['NOT_AN_AGENT'] as any,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lists membership templates newest first with their teams', async () => {
    prisma.membershipTemplate.findMany.mockResolvedValue([baseRow]);

    const result = await service.listMemberships();

    expect(prisma.membershipTemplate.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      include: membershipTemplateInclude,
    });
    expect(result[0].id).toBe('membership-template-1');
    expect(result[0].includedTeams).toEqual([]);
  });

  it('gets a membership template by id', async () => {
    prisma.membershipTemplate.findUnique.mockResolvedValue(baseRow);

    const result = await service.getMembership('membership-template-1');

    expect(prisma.membershipTemplate.findUnique).toHaveBeenCalledWith({
      where: { id: 'membership-template-1' },
      include: membershipTemplateInclude,
    });
    expect(result.id).toBe('membership-template-1');
  });

  it('throws when a membership template is not found', async () => {
    prisma.membershipTemplate.findUnique.mockResolvedValue(null);

    await expect(service.getMembership('missing-template')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('updates agents without touching teams when includedTeamIds is omitted', async () => {
    prisma.membershipTemplate.findUnique.mockResolvedValue(baseRow);
    prisma.membershipTemplate.update.mockResolvedValue({
      ...baseRow,
      name: 'Pro Plus',
    });

    await service.updateMembership('membership-template-1', {
      name: 'Pro Plus',
      includedAgents: ['JIM', 'SARA_AI'] as any,
    });

    expect(prisma.membershipTemplateTeam.deleteMany).not.toHaveBeenCalled();
    expect(prisma.membershipTemplateTeam.upsert).not.toHaveBeenCalled();
    expect(prisma.membershipTemplate.update).toHaveBeenCalledWith({
      where: { id: 'membership-template-1' },
      data: {
        name: 'Pro Plus',
        durationDays: undefined,
        monthlyTokenLimit: undefined,
        includedAgents: ['JIM', 'SARA_AI'],
      },
      include: membershipTemplateInclude,
    });
  });

  it('replaces the team list without touching agents when includedAgents is omitted', async () => {
    prisma.membershipTemplate.findUnique.mockResolvedValue(baseRow);
    prisma.agentTeam.findMany.mockResolvedValue([{ id: 't2' }]);
    prisma.membershipTemplate.update.mockResolvedValue(baseRow);

    await service.updateMembership('membership-template-1', {
      includedTeamIds: ['t2'],
    });

    expect(prisma.membershipTemplateTeam.deleteMany).toHaveBeenCalledWith({
      where: {
        membershipTemplateId: 'membership-template-1',
        teamId: { notIn: ['t2'] },
      },
    });
    expect(prisma.membershipTemplateTeam.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.membershipTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ includedAgents: undefined }),
      }),
    );
  });

  it('adds and removes single agents independently of teams', async () => {
    prisma.membershipTemplate.findUnique.mockResolvedValue({
      ...baseRow,
      includedTeams: [teamLink('t1', ['TONY'])],
    });
    prisma.membershipTemplate.update.mockResolvedValue(baseRow);

    await service.addAgents('membership-template-1', ['SARA_AI', 'JIM']);
    expect(prisma.membershipTemplate.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ includedAgents: ['JIM', 'SARA_AI'] }),
      }),
    );

    await service.removeAgent('membership-template-1', 'JIM');
    expect(prisma.membershipTemplate.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ includedAgents: [] }),
      }),
    );
    // Team links are never rewritten by the agent endpoints.
    expect(prisma.membershipTemplateTeam.deleteMany).not.toHaveBeenCalled();

    await expect(
      service.removeAgent('membership-template-1', 'LARA'),
    ).rejects.toThrow(NotFoundException);
  });

  it('adds and removes teams independently of single agents', async () => {
    prisma.membershipTemplate.findUnique.mockResolvedValue(baseRow);
    prisma.agentTeam.findMany.mockResolvedValue([{ id: 't1' }]);
    prisma.membershipTemplateTeam.createMany.mockResolvedValue({ count: 1 });

    await service.addTeams('membership-template-1', ['t1']);
    expect(prisma.membershipTemplateTeam.createMany).toHaveBeenCalledWith({
      data: [{ membershipTemplateId: 'membership-template-1', teamId: 't1' }],
      skipDuplicates: true,
    });

    prisma.membershipTemplateTeam.deleteMany.mockResolvedValue({ count: 1 });
    await service.removeTeam('membership-template-1', 't1');
    expect(prisma.membershipTemplateTeam.deleteMany).toHaveBeenCalledWith({
      where: { membershipTemplateId: 'membership-template-1', teamId: 't1' },
    });
    // The single-agent list is never rewritten by the team endpoints.
    expect(prisma.membershipTemplate.update).not.toHaveBeenCalled();

    prisma.membershipTemplateTeam.deleteMany.mockResolvedValue({ count: 0 });
    await expect(
      service.removeTeam('membership-template-1', 't9'),
    ).rejects.toThrow(NotFoundException);
  });

  it('deletes an existing membership template', async () => {
    prisma.membershipTemplate.findUnique.mockResolvedValue(baseRow);
    prisma.assignedMembership.deleteMany.mockResolvedValue({ count: 2 });
    prisma.membershipTemplate.delete.mockResolvedValue(baseRow);

    const result = await service.deleteMembership('membership-template-1');

    expect(prisma.assignedMembership.deleteMany).toHaveBeenCalledWith({
      where: { membershipTemplateId: 'membership-template-1' },
    });
    expect(prisma.membershipTemplate.delete).toHaveBeenCalledWith({
      where: { id: 'membership-template-1' },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('membership-template-1');
  });

  // One ledger row (DailyTokenUsage) as the pool reads it.
  const ledger = (
    agentName: string,
    date: string,
    input: number,
    output: number,
  ) => ({
    agentName,
    date: new Date(`${date}T00:00:00.000Z`),
    inputTokens: input,
    outputTokens: output,
    totalTokens: input + output,
  });

  it('assigns a membership using template duration and token limit', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-22T07:32:00.000Z'));
    prisma.membershipTemplate.findUnique.mockResolvedValue({
      id: 'membership-template-1',
      durationDays: 30,
      monthlyTokenLimit: 100000,
    });
    prisma.assignedMembership.create.mockResolvedValue(
      assignmentRow({
        startsAt: new Date('2026-05-22T07:32:00.000Z'),
        cycleStartsAt: new Date('2026-05-22T07:32:00.000Z'),
      }),
    );
    // ALEX spent 3,750 earlier the same day, before the membership existed.
    prisma.dailyTokenUsage.findMany.mockResolvedValue([
      ledger('ALEX', '2026-05-22', 2400, 1350),
    ]);

    const result = await service.assignMembership(
      'user-1',
      'membership-template-1',
    );

    expect(prisma.assignedMembership.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        membershipTemplateId: 'membership-template-1',
        startsAt: new Date('2026-05-22T07:32:00.000Z'),
        expiresAt: new Date('2026-06-21T07:32:00.000Z'),
        isActive: true,
        monthlyTokenLimit: 100000,
        cycleStartsAt: new Date('2026-05-22T07:32:00.000Z'),
        tokensLeft: 100000,
      },
      include: expect.any(Object),
    });
    // The ledger window opens at the start of the cycle's day.
    expect(prisma.dailyTokenUsage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          oauthId: 'oauth-1',
          date: { gte: new Date('2026-05-22T00:00:00.000Z') },
        },
      }),
    );
    expect(result.id).toBe('assigned-membership-1');
    expect(result.monthlyTokenLimit).toBe(100000);
    expect(result.usedTokens).toBe(3750);
    expect(result.tokensLeft).toBe(96250);
    // Every agent the template reaches shares that one pool.
    expect(result.agents).toEqual(['ALEX', 'LARA']);
  });

  it('assigns a membership using duration and token overrides', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-22T00:00:00.000Z'));
    prisma.membershipTemplate.findUnique.mockResolvedValue({
      id: 'membership-template-1',
      durationDays: 30,
      monthlyTokenLimit: 100000,
    });
    prisma.assignedMembership.create.mockResolvedValue(
      assignmentRow({ monthlyTokenLimit: 25000, tokensLeft: 25000 }),
    );

    await service.assignMembership('user-1', 'membership-template-1', 7, 25000);

    expect(prisma.assignedMembership.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        membershipTemplateId: 'membership-template-1',
        expiresAt: new Date('2026-05-29T00:00:00.000Z'),
        isActive: true,
        monthlyTokenLimit: 25000,
        tokensLeft: 25000,
      }),
      include: expect.any(Object),
    });
  });

  it('throws when assigning a missing membership template', async () => {
    prisma.membershipTemplate.findUnique.mockResolvedValue(null);

    await expect(
      service.assignMembership('user-1', 'missing-template'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.assignedMembership.create).not.toHaveBeenCalled();
  });

  /* --------------------------- shared token pool --------------------------- */

  describe('shared token pool', () => {
    it('sums every covered agent into ONE pool and ignores agents outside it', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-10T00:00:00.000Z'));
      prisma.assignedMembership.findUnique.mockResolvedValue(assignmentRow());
      prisma.dailyTokenUsage.findMany.mockResolvedValue([
        ledger('ALEX', '2026-05-03', 1000, 500),
        // LARA is only reachable through the membership's team.
        ledger('LARA', '2026-05-09', 2000, 1000),
        // TONY is not in the membership: his spend is not the pool's.
        ledger('TONY', '2026-05-09', 9000, 9000),
      ]);

      const view = await service.getAssignment('assigned-membership-1');

      expect(view.usedTokens).toBe(4500);
      expect(view.inputTokens).toBe(3000);
      expect(view.outputTokens).toBe(1500);
      expect(view.tokensLeft).toBe(95500);
      // A read never writes.
      expect(prisma.assignedMembership.update).not.toHaveBeenCalled();
    });

    it('starts a fresh pool when a new 30-day cycle begins', async () => {
      // Grant started May 1; on June 5 the second cycle (May 31 ->) is current.
      jest.useFakeTimers().setSystemTime(new Date('2026-06-05T00:00:00.000Z'));
      prisma.assignedMembership.findUnique.mockResolvedValue(assignmentRow());
      prisma.dailyTokenUsage.findMany.mockResolvedValue([
        ledger('ALEX', '2026-05-20', 50000, 40000), // previous cycle
        ledger('ALEX', '2026-06-01', 1000, 1000), // current cycle
      ]);

      const view = await service.getAssignment('assigned-membership-1');

      expect(view.cycleStartsAt).toEqual(new Date('2026-05-31T00:00:00.000Z'));
      expect(view.usedTokens).toBe(2000);
      expect(view.tokensLeft).toBe(98000);
    });

    it('re-prices tokensLeft against the cycle spend when the allowance changes', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-10T00:00:00.000Z'));
      const row = assignmentRow();
      prisma.assignedMembership.findUnique.mockResolvedValue(row);
      prisma.assignedMembership.update.mockResolvedValue({
        ...row,
        monthlyTokenLimit: 50000,
      });
      prisma.dailyTokenUsage.findMany.mockResolvedValue([
        ledger('ALEX', '2026-05-05', 20000, 10000),
      ]);

      const result = await service.updateAssignment('assigned-membership-1', {
        monthlyTokenLimit: 50000,
      });

      expect(prisma.assignedMembership.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'assigned-membership-1' },
        data: { monthlyTokenLimit: 50000 },
        include: expect.any(Object),
      });
      // The cached rollup follows.
      expect(prisma.assignedMembership.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'assigned-membership-1' },
        data: expect.objectContaining({ usedTokens: 30000, tokensLeft: 20000 }),
      });
      expect(result.tokensLeft).toBe(20000);
    });

    it('rejects a negative allowance', async () => {
      prisma.assignedMembership.findUnique.mockResolvedValue(assignmentRow());
      await expect(
        service.updateAssignment('assigned-membership-1', {
          monthlyTokenLimit: -1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('records a chat of ANY covered agent in the ledger and re-sums the pool', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-10T00:00:00.000Z'));
      prisma.assignedMembership.findUnique.mockResolvedValue(assignmentRow());
      prisma.assignedMembership.update.mockResolvedValue({});
      // The ledger as it stands after the chat was written.
      prisma.dailyTokenUsage.findMany.mockResolvedValue([
        ledger('ALEX', '2026-05-02', 600, 400),
        ledger('LARA', '2026-05-10', 1200, 1300),
      ]);

      const result = await service.recordTokenUsage(
        'assigned-membership-1',
        'LARA',
        {
          agentName: 'LARA' as any,
          inputTokens: 1200,
          outputTokens: 1300,
        },
      );

      expect(tokenUsage.applyAgentTokenDelta).toHaveBeenCalledWith(
        'u@example.com',
        'LARA',
        { totalTokens: 2500, inputTokens: 1200, outputTokens: 1300 },
        { syncTeamGrants: false, syncMembershipGrants: false },
      );
      expect(prisma.assignedMembership.update).toHaveBeenCalledWith({
        where: { id: 'assigned-membership-1' },
        data: expect.objectContaining({
          usedTokens: 3500,
          inputTokens: 1800,
          outputTokens: 1700,
          tokensLeft: 96500,
        }),
      });
      expect(result.usedTokens).toBe(3500);
      expect(result.tokensLeft).toBe(96500);
    });

    it('refuses an agent the membership does not reach', async () => {
      prisma.assignedMembership.findUnique.mockResolvedValue(assignmentRow());
      await expect(
        service.recordTokenUsage('assigned-membership-1', 'TONY', {
          agentName: 'TONY' as any,
          inputTokens: 1,
          outputTokens: 1,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.assignedMembership.update).not.toHaveBeenCalled();
      expect(tokenUsage.applyAgentTokenDelta).not.toHaveBeenCalled();
    });
  });
});
