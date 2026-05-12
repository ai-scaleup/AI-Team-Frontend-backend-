import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMembershipDto } from './dto/membership.dto';

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
        includedGroupIds: data.includedGroupIds || [],
      },
    });
  }

  async listMemberships() {
    return this.prisma.membershipTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async assignMembership(
    userId: string,
    membershipTemplateId: string,
    durationOverride?: number,
  ) {
    const template = await this.prisma.membershipTemplate.findUnique({
      where: { id: membershipTemplateId },
    });
    if (!template) throw new NotFoundException('Template not found');

    const durationDays = durationOverride ?? template.durationDays;
    const msPerDay = 1000 * 60 * 60 * 24;
    const expiresAt = new Date(Date.now() + durationDays * msPerDay);

    return this.prisma.assignedMembership.create({
      data: {
        userId,
        membershipTemplateId,
        expiresAt,
        isActive: true,
      },
    });
  }
}
