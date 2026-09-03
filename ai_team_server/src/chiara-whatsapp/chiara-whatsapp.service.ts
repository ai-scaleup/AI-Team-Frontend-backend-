import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from 'src/generated/prisma/client';

@Injectable()
export class ChiaraWhatsappService {
  constructor(private prisma: PrismaService) {}

  // A session can hold many leads here, so a create never conflicts.
  async createLead(data: Prisma.ChiaraWhatsappLeadCreateInput) {
    return this.prisma.chiaraWhatsappLead.create({ data });
  }

  async getAllLeads() {
    return this.prisma.chiaraWhatsappLead.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLeadsBySessionId(sessionId: string) {
    return this.prisma.chiaraWhatsappLead.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLeadById(id: number) {
    const lead = await this.prisma.chiaraWhatsappLead.findUnique({
      where: { id },
    });

    if (!lead) {
      throw new NotFoundException(`No WhatsApp lead with id ${id}.`);
    }

    return lead;
  }

  async updateLead(id: number, data: Prisma.ChiaraWhatsappLeadUpdateInput) {
    await this.getLeadById(id);

    return this.prisma.chiaraWhatsappLead.update({
      where: { id },
      data,
    });
  }

  async deleteLead(id: number) {
    await this.getLeadById(id);

    return this.prisma.chiaraWhatsappLead.delete({
      where: { id },
    });
  }
}
