import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { UserPreference, AgentName } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateUserPreferenceDto,
  UpdateUserPreferenceDto,
} from '../schemas/user-preference.schema';

type UserIdentifier = {
  oauthId?: string;
  email?: string;
};

type ResolvedUser = {
  oauthId: string;
  email: string;
};

@Injectable()
export class UserPreferenceService {
  constructor(private prisma: PrismaService) {}

  private async resolveUser(
    identifier: string | UserIdentifier,
  ): Promise<ResolvedUser> {
    const trimmedIdentifier =
      typeof identifier === 'string' ? identifier.trim() : undefined;
    const isEmailIdentifier = trimmedIdentifier?.includes('@') ?? false;
    const oauthId =
      typeof identifier === 'string'
        ? isEmailIdentifier
          ? undefined
          : trimmedIdentifier
        : identifier.oauthId;
    const email =
      typeof identifier === 'string'
        ? isEmailIdentifier
          ? trimmedIdentifier
          : undefined
        : identifier.email?.trim();

    if (email) {
      const user = await this.prisma.user.findFirst({
        where: {
          email: {
            equals: email,
            mode: 'insensitive',
          },
        },
        select: { oauthId: true, email: true },
      });

      if (!user) {
        throw new NotFoundException(`User with email "${email}" not found.`);
      }

      if (oauthId && oauthId !== user.oauthId) {
        throw new BadRequestException(
          'Email and OAuth ID refer to different users.',
        );
      }

      return user;
    }

    if (!oauthId) {
      throw new BadRequestException('OAuth ID or email is required.');
    }

    const user = await this.prisma.user.findUnique({
      where: { oauthId },
      select: { oauthId: true, email: true },
    });

    if (!user) {
      throw new NotFoundException(`User with OAuth ID "${oauthId}" not found.`);
    }

    return user;
  }

  private async resolveOauthId(
    identifier: string | UserIdentifier,
  ): Promise<string> {
    const user = await this.resolveUser(identifier);
    return user.oauthId;
  }

  private normalizeEmailIdentifier(userIdentifier: string): string {
    const email = userIdentifier.trim();

    if (!email.includes('@')) {
      throw new BadRequestException('Email is required for this endpoint.');
    }

    return email;
  }

  // Create new preferences for a user + agent combination
  async createPreference(
    data: CreateUserPreferenceDto,
  ): Promise<UserPreference> {
    const user = await this.resolveUser(data);
    const { email: _email, oauthId: _oauthId, ...preferenceData } = data;

    // Check if preference already exists for this user + agent
    const existing = await this.prisma.userPreference.findUnique({
      where: {
        oauthId_agentName: {
          oauthId: user.oauthId,
          agentName: data.agentName as AgentName,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Preferences for agent "${data.agentName}" already exist for this user.`,
      );
    }

    return this.prisma.userPreference.create({
      data: {
        ...preferenceData,
        oauthId: user.oauthId,
        email: user.email,
        agentName: data.agentName as AgentName,
      },
    });
  }

  // Get all preferences for a user (all agents)
  async findAllByOauthId(oauthId: string): Promise<UserPreference[]> {
    return this.findAllByUserIdentifier(oauthId);
  }

  async findAllByUserIdentifier(
    userIdentifier: string,
  ): Promise<UserPreference[]> {
    const email = this.normalizeEmailIdentifier(userIdentifier);

    return this.prisma.userPreference.findMany({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get preferences for a specific user + agent
  async findByOauthIdAndAgent(
    oauthId: string,
    agentName: AgentName,
  ): Promise<UserPreference> {
    return this.findByUserIdentifierAndAgent(oauthId, agentName);
  }

  async findByUserIdentifierAndAgent(
    userIdentifier: string,
    agentName: AgentName,
  ): Promise<UserPreference> {
    const email = this.normalizeEmailIdentifier(userIdentifier);

    const preference = await this.prisma.userPreference.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
        agentName,
      },
    });

    if (!preference) {
      throw new NotFoundException(
        `Preferences for agent "${agentName}" not found for this user.`,
      );
    }

    return preference;
  }

  // Get preference by ID
  async findById(id: string): Promise<UserPreference> {
    const preference = await this.prisma.userPreference.findUnique({
      where: { id },
    });

    if (!preference) {
      throw new NotFoundException(`Preference with ID "${id}" not found.`);
    }

    return preference;
  }

  // Update preferences for a user + agent
  async updateByOauthIdAndAgent(
    oauthId: string,
    agentName: AgentName,
    data: UpdateUserPreferenceDto,
  ): Promise<UserPreference> {
    return this.updateByUserIdentifierAndAgent(oauthId, agentName, data);
  }

  async updateByUserIdentifierAndAgent(
    userIdentifier: string,
    agentName: AgentName,
    data: UpdateUserPreferenceDto,
  ): Promise<UserPreference> {
    const user = await this.resolveUser(userIdentifier);

    // Verify it exists
    await this.findByUserIdentifierAndAgent(user.oauthId, agentName);

    return this.prisma.userPreference.update({
      where: {
        oauthId_agentName: {
          oauthId: user.oauthId,
          agentName,
        },
      },
      data: {
        email: user.email,
        ...data,
      },
    });
  }

  // Upsert preferences (create if not exists, update if exists)
  async upsertByOauthIdAndAgent(
    oauthId: string,
    agentName: AgentName,
    data: UpdateUserPreferenceDto,
  ): Promise<UserPreference> {
    return this.upsertByUserIdentifierAndAgent(oauthId, agentName, data);
  }

  async upsertByUserIdentifierAndAgent(
    userIdentifier: string,
    agentName: AgentName,
    data: UpdateUserPreferenceDto,
  ): Promise<UserPreference> {
    const user = await this.resolveUser(userIdentifier);

    return this.prisma.userPreference.upsert({
      where: {
        oauthId_agentName: {
          oauthId: user.oauthId,
          agentName,
        },
      },
      create: {
        oauthId: user.oauthId,
        email: user.email,
        agentName,
        ...data,
      },
      update: {
        email: user.email,
        ...data,
      },
    });
  }

  // Delete preferences for a user + agent
  async deleteByOauthIdAndAgent(
    oauthId: string,
    agentName: AgentName,
  ): Promise<void> {
    return this.deleteByUserIdentifierAndAgent(oauthId, agentName);
  }

  async deleteByUserIdentifierAndAgent(
    userIdentifier: string,
    agentName: AgentName,
  ): Promise<void> {
    const oauthId = await this.resolveOauthId(userIdentifier);

    await this.findByUserIdentifierAndAgent(oauthId, agentName);

    await this.prisma.userPreference.delete({
      where: {
        oauthId_agentName: {
          oauthId,
          agentName,
        },
      },
    });
  }

  // Delete all preferences for a user
  async deleteAllByOauthId(oauthId: string): Promise<{ count: number }> {
    return this.deleteAllByUserIdentifier(oauthId);
  }

  async deleteAllByUserIdentifier(
    userIdentifier: string,
  ): Promise<{ count: number }> {
    const oauthId = await this.resolveOauthId(userIdentifier);

    const result = await this.prisma.userPreference.deleteMany({
      where: { oauthId },
    });
    return { count: result.count };
  }

  // Delete preference by ID
  async deleteById(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.userPreference.delete({
      where: { id },
    });
  }

  // Get or create default preferences for a user + agent
  async getOrCreateDefault(
    oauthId: string,
    agentName: AgentName,
  ): Promise<UserPreference> {
    return this.getOrCreateDefaultByUserIdentifier(oauthId, agentName);
  }

  async getOrCreateDefaultByUserIdentifier(
    userIdentifier: string,
    agentName: AgentName,
  ): Promise<UserPreference> {
    const email = this.normalizeEmailIdentifier(userIdentifier);

    const existing = await this.prisma.userPreference.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
        agentName,
      },
    });

    if (existing) {
      return existing;
    }

    const user = await this.resolveUser({ email });

    // Create with default values (Prisma will use schema defaults)
    return this.prisma.userPreference.create({
      data: {
        oauthId: user.oauthId,
        email: user.email,
        agentName,
      },
    });
  }
}
