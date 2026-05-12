import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentName, Prisma, User } from 'src/generated/prisma/client';

import {
  CreateUserDto,
  ListUsersQueryDto,
  UpdateUserDto,
} from '../schemas/user.schema';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  // Create a new user
  async createUser(data: CreateUserDto): Promise<User> {
    return this.prisma.user.create({ data });
  }

  // Get users with pagination
  async findAllUsers(query: ListUsersQueryDto) {
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;
    const searchTerm = search?.trim();
    const normalizedAgentSearch = searchTerm
      ?.toUpperCase()
      .replace(/[\s-]+/g, '_')
      .replace(/[^A-Z0-9_]/g, '');
    const matchingAgents = normalizedAgentSearch
      ? Object.values(AgentName).filter((agentName) =>
          agentName.includes(normalizedAgentSearch),
        )
      : [];
    const where: Prisma.UserWhereInput | undefined = searchTerm
      ? {
          OR: [
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { username: { contains: searchTerm, mode: 'insensitive' } },
            {
              groups: {
                some: {
                  group: {
                    name: { contains: searchTerm, mode: 'insensitive' },
                  },
                },
              },
            },
            {
              memberships: {
                some: {
                  template: {
                    name: { contains: searchTerm, mode: 'insensitive' },
                  },
                },
              },
            },
            ...(matchingAgents.length
              ? [
                  { agents: { some: { agentName: { in: matchingAgents } } } },
                  {
                    groups: {
                      some: {
                        group: {
                          items: {
                            some: { agentName: { in: matchingAgents } },
                          },
                        },
                      },
                    },
                  },
                  {
                    memberships: {
                      some: {
                        template: {
                          includedAgents: { hasSome: matchingAgents },
                        },
                      },
                    },
                  },
                ]
              : []),
          ],
        }
      : undefined;

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          agents: true,
          groups: {
            where: { isActive: true },
            include: { group: true },
          },
          memberships: { include: { template: true } },
          dailyUsage: {
            where: {
              date: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
            orderBy: { date: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const totalPages = Math.ceil(total / limit);

    return {
      data: users.map((user) => {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        const today = new Date(now.toISOString().split('T')[0] + 'T00:00:00Z');

        return {
          ...user,
          usage: {
            monthly: user.dailyUsage.reduce(
              (sum, item) => sum + item.totalTokens,
              0,
            ),
            weekly: user.dailyUsage
              .filter((item) => item.date >= weekStart)
              .reduce((sum, item) => sum + item.totalTokens, 0),
            daily: user.dailyUsage
              .filter((item) => item.date >= today)
              .reduce((sum, item) => sum + item.totalTokens, 0),
          },
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  // Get a single user by ID
  async findUserById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }
    return user;
  }

  // Update a user by ID
  async updateUser(id: string, data: UpdateUserDto): Promise<User> {
    await this.findUserById(id); // Ensure user exists
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  // Delete a user by ID
  async deleteUser(id: string): Promise<void> {
    await this.findUserById(id); // Ensure user exists

    // This will cascade delete all related userData due to Prisma's referential actions
    await this.prisma.user.delete({
      where: { id },
    });
  }

  // Additional helper methods for OAuth-based operations
  async findUserByOauthId(oauthId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { oauthId },
    });
    if (!user) {
      throw new NotFoundException(`User with OAuth ID "${oauthId}" not found.`);
    }
    return user;
  }

  async updateUserByOauthId(
    oauthId: string,
    data: UpdateUserDto,
  ): Promise<User> {
    const user = await this.findUserByOauthId(oauthId);
    return this.prisma.user.update({
      where: { id: user.id },
      data,
    });
  }

  async deleteUserByOauthId(oauthId: string): Promise<void> {
    const user = await this.findUserByOauthId(oauthId);
    await this.prisma.user.delete({
      where: { id: user.id },
    });
  }

  // Sync user from Clerk: create if not exists, update email/username if exists
  async syncUser(
    oauthId: string,
    email: string,
    username?: string,
  ): Promise<User> {
    return this.prisma.user.upsert({
      where: { oauthId },
      create: { oauthId, email, username },
      update: { email, username },
    });
  }

  // ALERTS
  async getAlerts(oauthId: string) {
    const user = await this.findUserByOauthId(oauthId);
    return this.prisma.userAlert.findMany({
      where: { userId: user.id, read: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async dismissAlert(alertId: string) {
    return this.prisma.userAlert.update({
      where: { id: alertId },
      data: { read: true },
    });
  }
}
