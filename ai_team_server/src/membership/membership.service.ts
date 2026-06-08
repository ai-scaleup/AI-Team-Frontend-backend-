import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateMembershipDto,
  UpdateMembershipDto,
} from './dto/membership.dto';

@Injectable()
export class MembershipService {
  constructor(private readonly prisma: PrismaService) {}

  async createMembership(data: CreateMembershipDto) {
    return this.prisma.membershipTemplate.create({
      data: {
        name: data.name,
        durationDays: data.durationDays,
        monthlyTokenLimit: data.monthlyTokenLimit,
        includedAgents: data.includedAgents || [],
      },
    });
  }

  async listMemberships() {
    return this.prisma.membershipTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMembership(id: string) {
    const membership = await this.prisma.membershipTemplate.findUnique({
      where: { id },
    });

    if (!membership) throw new NotFoundException('Membership not found');

    return membership;
  }

  async updateMembership(id: string, data: UpdateMembershipDto) {
    await this.getMembership(id);

    return this.prisma.membershipTemplate.update({
      where: { id },
      data: {
        name: data.name,
        durationDays: data.durationDays,
        monthlyTokenLimit: data.monthlyTokenLimit,
        includedAgents: data.includedAgents,
      },
    });
  }

  async deleteMembership(id: string) {
    await this.getMembership(id);

    const [, deletedMembership] = await this.prisma.$transaction([
      this.prisma.assignedMembership.deleteMany({
        where: { membershipTemplateId: id },
      }),
      this.prisma.membershipTemplate.delete({
        where: { id },
      }),
    ]);

    return deletedMembership;
  }

  async assignMembership(
    userId: string,
    membershipTemplateId: string,
    durationOverride?: number,
    monthlyTokenLimitOverride?: number,
  ) {
    const template = await this.prisma.membershipTemplate.findUnique({
      where: { id: membershipTemplateId },
    });
    if (!template) throw new NotFoundException('Template not found');

    const durationDays = durationOverride ?? template.durationDays;
    const monthlyTokenLimit =
      monthlyTokenLimitOverride ?? template.monthlyTokenLimit;
    const msPerDay = 1000 * 60 * 60 * 24;
    const expiresAt = new Date(Date.now() + durationDays * msPerDay);

    return this.prisma.assignedMembership.create({
      data: {
        userId,
        membershipTemplateId,
        expiresAt,
        isActive: true,
        monthlyTokenLimit,
      },
    });
  }
}
