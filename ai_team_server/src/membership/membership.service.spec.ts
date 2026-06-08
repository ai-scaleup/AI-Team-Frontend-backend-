import { NotFoundException } from '@nestjs/common';
import { MembershipService } from './membership.service';

describe('MembershipService', () => {
  const prisma = {
    $transaction: jest.fn(),
    membershipTemplate: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    assignedMembership: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  let service: MembershipService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    prisma.$transaction.mockImplementation(async (operations) =>
      Promise.all(operations),
    );
    service = new MembershipService(prisma as any);
  });

  it('creates a membership template with included agents', async () => {
    const membership = {
      id: 'membership-template-1',
      name: 'Pro',
      durationDays: 30,
      monthlyTokenLimit: 100000,
      includedAgents: ['JIM', 'SARA_AI'],
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
    });
    expect(result).toBe(membership);
  });

  it('creates a membership template with no included agents by default', async () => {
    prisma.membershipTemplate.create.mockResolvedValue({
      id: 'membership-template-1',
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
    });
  });

  it('lists membership templates newest first', async () => {
    const memberships = [{ id: 'membership-template-1' }];
    prisma.membershipTemplate.findMany.mockResolvedValue(memberships);

    const result = await service.listMemberships();

    expect(prisma.membershipTemplate.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toBe(memberships);
  });

  it('gets a membership template by id', async () => {
    const membership = { id: 'membership-template-1' };
    prisma.membershipTemplate.findUnique.mockResolvedValue(membership);

    const result = await service.getMembership('membership-template-1');

    expect(prisma.membershipTemplate.findUnique).toHaveBeenCalledWith({
      where: { id: 'membership-template-1' },
    });
    expect(result).toBe(membership);
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
    });
    prisma.membershipTemplate.update.mockResolvedValue({
      id: 'membership-template-1',
      name: 'Pro Plus',
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
    expect(result).toEqual({ id: 'membership-template-1', name: 'Pro Plus' });
  });

  it('deletes an existing membership template', async () => {
    prisma.membershipTemplate.findUnique.mockResolvedValue({
      id: 'membership-template-1',
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
    expect(result).toEqual({ id: 'assigned-membership-1' });
  });

  it('assigns a membership using duration and token overrides', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-22T00:00:00.000Z'));
    prisma.membershipTemplate.findUnique.mockResolvedValue({
      id: 'membership-template-1',
      durationDays: 30,
      monthlyTokenLimit: 100000,
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

  it('throws when assigning a missing membership template', async () => {
    prisma.membershipTemplate.findUnique.mockResolvedValue(null);

    await expect(
      service.assignMembership('user-1', 'missing-template'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.assignedMembership.create).not.toHaveBeenCalled();
  });
});
