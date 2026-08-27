import { NotFoundException } from '@nestjs/common';
import { MembershipService } from './membership.service';

describe('MembershipService', () => {
  const prisma = {
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
    membershipTemplate: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    membershipTemplateGroup: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    assignedMembership: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    agentGroup: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    assignedGroup: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    assignedAgent: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  // Every read of a template now carries its live teams.
  const templateInclude = {
    includedGroups: {
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        groupId: true,
        group: {
          select: {
            id: true,
            name: true,
            description: true,
            isActive: true,
            singleConversationTokenLimit: true,
            items: { select: { agentName: true } },
          },
        },
      },
    },
  };

  const link = (groupId: string, name = groupId) => ({
    id: 'link-' + groupId,
    groupId,
    group: { id: groupId, name, items: [] },
  });

  let service: MembershipService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    // deleteMembership passes an array of promises; updateMembership passes a
    // callback that receives the transaction client.
    prisma.$transaction.mockImplementation(async (arg: any) =>
      typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
    );
    prisma.membershipTemplateGroup.findMany.mockResolvedValue([]);
    service = new MembershipService(prisma as any);
  });

  it('creates a membership template with included agents', async () => {
    const membership = {
      id: 'membership-template-1',
      name: 'Pro',
      durationDays: 30,
      monthlyTokenLimit: 100000,
      includedAgents: ['JIM', 'SARA_AI'],
      includedGroups: [],
    };
    prisma.membershipTemplate.create.mockResolvedValue(membership);

    const result = await service.createMembership({
      name: 'Pro',
      durationDays: 30,
      monthlyTokenLimit: 100000,
      includedAgents: ['JIM', 'SARA_AI'] as any,
    });

    expect(prisma.membershipTemplate.create).toHaveBeenCalledWith({
      data: {
        name: 'Pro',
        durationDays: 30,
        monthlyTokenLimit: 100000,
        includedAgents: ['JIM', 'SARA_AI'],
      },
      include: templateInclude,
    });
    expect(result).toEqual({ ...membership, includedGroupIds: [] });
  });

  it('creates a membership template with no included agents by default', async () => {
    prisma.membershipTemplate.create.mockResolvedValue({
      id: 'membership-template-1',
      includedAgents: [],
      includedGroups: [],
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
      include: templateInclude,
    });
  });

  it('creates a membership template that bundles teams', async () => {
    prisma.agentGroup.findMany.mockResolvedValue([
      { id: 'group-1' },
      { id: 'group-2' },
    ]);
    prisma.membershipTemplate.create.mockResolvedValue({
      id: 'membership-template-1',
      includedGroups: [link('group-1'), link('group-2')],
    });

    const result = await service.createMembership({
      name: 'SEO Trial',
      durationDays: 30,
      monthlyTokenLimit: 80000,
      includedGroupIds: ['group-1', 'group-2', 'group-1'],
    });

    expect(prisma.membershipTemplate.create).toHaveBeenCalledWith({
      data: {
        name: 'SEO Trial',
        durationDays: 30,
        monthlyTokenLimit: 80000,
        includedAgents: [],
        // Duplicates collapse to one link per team.
        includedGroups: {
          create: [{ groupId: 'group-1' }, { groupId: 'group-2' }],
        },
      },
      include: templateInclude,
    });
    // The admin UI reads team chips off this flat list.
    expect(result.includedGroupIds).toEqual(['group-1', 'group-2']);
  });

  it('rejects a membership that bundles an unknown team', async () => {
    prisma.agentGroup.findMany.mockResolvedValue([{ id: 'group-1' }]);

    await expect(
      service.createMembership({
        name: 'Broken Plan',
        durationDays: 30,
        monthlyTokenLimit: 80000,
        includedGroupIds: ['group-1', 'group-missing'],
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.membershipTemplate.create).not.toHaveBeenCalled();
  });

  it('lists membership templates newest first', async () => {
    prisma.membershipTemplate.findMany.mockResolvedValue([
      { id: 'membership-template-1', includedGroups: [link('group-1')] },
    ]);

    const result = await service.listMemberships();

    expect(prisma.membershipTemplate.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      include: templateInclude,
    });
    expect(result[0].includedGroupIds).toEqual(['group-1']);
  });

  it('gets a membership template by id', async () => {
    prisma.membershipTemplate.findUnique.mockResolvedValue({
      id: 'membership-template-1',
      includedGroups: [link('group-1')],
    });

    const result = await service.getMembership('membership-template-1');

    expect(prisma.membershipTemplate.findUnique).toHaveBeenCalledWith({
      where: { id: 'membership-template-1' },
      include: templateInclude,
    });
    expect(result).toEqual({
      id: 'membership-template-1',
      includedGroups: [link('group-1')],
      includedGroupIds: ['group-1'],
    });
  });

  it('throws when a membership template is not found', async () => {
    prisma.membershipTemplate.findUnique.mockResolvedValue(null);

    await expect(service.getMembership('missing-template')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('updates an existing membership template', async () => {
    prisma.membershipTemplate.findUnique.mockResolvedValue({
      id: 'membership-template-1',
      includedGroups: [],
    });
    prisma.membershipTemplate.update.mockResolvedValue({
      id: 'membership-template-1',
    });
    prisma.membershipTemplate.findUniqueOrThrow.mockResolvedValue({
      id: 'membership-template-1',
      name: 'Pro Plus',
      includedGroups: [],
    });

    const result = await service.updateMembership('membership-template-1', {
      name: 'Pro Plus',
      durationDays: 60,
      monthlyTokenLimit: 150000,
      includedAgents: ['JIM', 'SARA_AI'] as any,
    });

    expect(prisma.membershipTemplate.update).toHaveBeenCalledWith({
      where: { id: 'membership-template-1' },
      data: {
        name: 'Pro Plus',
        durationDays: 60,
        monthlyTokenLimit: 150000,
        includedAgents: ['JIM', 'SARA_AI'],
      },
    });
    // Teams were not mentioned, so the template's links are left alone.
    expect(prisma.membershipTemplateGroup.upsert).not.toHaveBeenCalled();
    expect(prisma.membershipTemplateGroup.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: 'membership-template-1',
      name: 'Pro Plus',
      includedGroups: [],
      includedGroupIds: [],
    });
  });

  it('unlinks a dropped team without deleting its row', async () => {
    prisma.membershipTemplate.findUnique.mockResolvedValue({
      id: 'membership-template-1',
      includedGroups: [],
    });
    prisma.membershipTemplate.update.mockResolvedValue({
      id: 'membership-template-1',
    });
    prisma.membershipTemplate.findUniqueOrThrow.mockResolvedValue({
      id: 'membership-template-1',
      includedGroups: [link('group-1')],
    });
    prisma.agentGroup.findMany.mockResolvedValue([{ id: 'group-1' }]);
    prisma.membershipTemplateGroup.findMany.mockResolvedValue([
      { id: 'link-1', groupId: 'group-1' },
      { id: 'link-2', groupId: 'group-2' },
    ]);

    await service.updateMembership('membership-template-1', {
      includedGroupIds: ['group-1'],
    });

    expect(prisma.membershipTemplateGroup.upsert).toHaveBeenCalledWith({
      where: {
        membershipTemplateId_groupId: {
          membershipTemplateId: 'membership-template-1',
          groupId: 'group-1',
        },
      },
      create: {
        membershipTemplateId: 'membership-template-1',
        groupId: 'group-1',
        isActive: true,
      },
      update: { isActive: true },
    });
    // The dropped team is deactivated, never removed.
    expect(prisma.membershipTemplateGroup.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['link-2'] } },
      data: { isActive: false },
    });
  });

  it('deletes an existing membership template', async () => {
    prisma.membershipTemplate.findUnique.mockResolvedValue({
      id: 'membership-template-1',
      includedGroups: [],
    });
    prisma.assignedMembership.deleteMany.mockResolvedValue({ count: 2 });
    prisma.membershipTemplate.delete.mockResolvedValue({
      id: 'membership-template-1',
    });

    const result = await service.deleteMembership('membership-template-1');

    expect(prisma.assignedMembership.deleteMany).toHaveBeenCalledWith({
      where: { membershipTemplateId: 'membership-template-1' },
    });
    expect(prisma.membershipTemplate.delete).toHaveBeenCalledWith({
      where: { id: 'membership-template-1' },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: 'membership-template-1' });
  });

  it('assigns a membership using template duration and token limit', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-22T00:00:00.000Z'));
    prisma.membershipTemplate.findUnique.mockResolvedValue({
      id: 'membership-template-1',
      durationDays: 30,
      monthlyTokenLimit: 100000,
      includedGroups: [],
    });
    prisma.assignedMembership.create.mockResolvedValue({
      id: 'assigned-membership-1',
    });

    const result = await service.assignMembership(
      'user-1',
      'membership-template-1',
    );

    expect(prisma.assignedMembership.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        membershipTemplateId: 'membership-template-1',
        expiresAt: new Date('2026-06-21T00:00:00.000Z'),
        isActive: true,
        monthlyTokenLimit: 100000,
      },
    });
    expect(prisma.assignedGroup.create).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'assigned-membership-1' });
  });

  it('assigns a membership using duration and token overrides', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-22T00:00:00.000Z'));
    prisma.membershipTemplate.findUnique.mockResolvedValue({
      id: 'membership-template-1',
      durationDays: 30,
      monthlyTokenLimit: 100000,
      includedGroups: [],
    });
    prisma.assignedMembership.create.mockResolvedValue({
      id: 'assigned-membership-1',
    });

    await service.assignMembership('user-1', 'membership-template-1', 7, 25000);

    expect(prisma.assignedMembership.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        membershipTemplateId: 'membership-template-1',
        expiresAt: new Date('2026-05-29T00:00:00.000Z'),
        isActive: true,
        monthlyTokenLimit: 25000,
      },
    });
  });

  it('grants the bundled team and its agents when the membership is assigned', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-22T00:00:00.000Z'));
    const expiresAt = new Date('2026-06-21T00:00:00.000Z');

    prisma.membershipTemplate.findUnique.mockResolvedValue({
      id: 'membership-template-1',
      durationDays: 30,
      monthlyTokenLimit: 80000,
      includedGroups: [{ groupId: 'group-1' }],
    });
    prisma.assignedMembership.create.mockResolvedValue({
      id: 'assigned-membership-1',
    });
    prisma.agentGroup.findUnique.mockResolvedValue({
      singleConversationTokenLimit: 0,
      items: [{ agentName: 'JIM' }, { agentName: 'SARA_AI' }],
    });
    prisma.assignedGroup.findFirst.mockResolvedValue(null);
    prisma.assignedAgent.findFirst.mockResolvedValue(null);

    await service.assignMembership('user-1', 'membership-template-1');

    expect(prisma.assignedGroup.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        groupId: 'group-1',
        expiresAt,
        durationDays: 30,
        isActive: true,
      },
    });
    // Access is read off AssignedAgent, so every agent on the team gets a row.
    expect(prisma.assignedAgent.create).toHaveBeenCalledTimes(2);
    expect(prisma.assignedAgent.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        agentName: 'JIM',
        expiresAt,
        durationDays: 30,
        isActive: true,
      },
    });
  });

  it('leaves a longer-running assignment alone when a membership grants the same team', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-22T00:00:00.000Z'));

    prisma.membershipTemplate.findUnique.mockResolvedValue({
      id: 'membership-template-1',
      durationDays: 30,
      monthlyTokenLimit: 80000,
      includedGroups: [{ groupId: 'group-1' }],
    });
    prisma.assignedMembership.create.mockResolvedValue({
      id: 'assigned-membership-1',
    });
    prisma.agentGroup.findUnique.mockResolvedValue({
      singleConversationTokenLimit: 0,
      items: [{ agentName: 'JIM' }],
    });
    // Already granted for a year, and an open-ended agent grant.
    prisma.assignedGroup.findFirst.mockResolvedValue({
      id: 'assigned-group-1',
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    });
    prisma.assignedAgent.findFirst.mockResolvedValue({
      id: 'assigned-agent-1',
      expiresAt: null,
    });

    await service.assignMembership('user-1', 'membership-template-1');

    expect(prisma.assignedGroup.update).not.toHaveBeenCalled();
    expect(prisma.assignedAgent.update).not.toHaveBeenCalled();
    expect(prisma.assignedGroup.create).not.toHaveBeenCalled();
    expect(prisma.assignedAgent.create).not.toHaveBeenCalled();
  });

  it('throws when assigning a missing membership template', async () => {
    prisma.membershipTemplate.findUnique.mockResolvedValue(null);

    await expect(
      service.assignMembership('user-1', 'missing-template'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.assignedMembership.create).not.toHaveBeenCalled();
  });
});
