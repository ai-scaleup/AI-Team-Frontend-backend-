import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { UserPreference, AgentName } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserPreferenceDto, UpdateUserPreferenceDto } from '../schemas/user-preference.schema';

@Injectable()
export class UserPreferenceService {
    constructor(private prisma: PrismaService) { }

    // Create new preferences for a user + agent combination
    async createPreference(data: CreateUserPreferenceDto): Promise<UserPreference> {
        // Check if preference already exists for this user + agent
        const existing = await this.prisma.userPreference.findUnique({
            where: {
                oauthId_agentName: {
                    oauthId: data.oauthId,
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
                ...data,
                agentName: data.agentName as AgentName,
            },
        });
    }

    // Get all preferences for a user (all agents)
    async findAllByOauthId(oauthId: string): Promise<UserPreference[]> {
        return this.prisma.userPreference.findMany({
            where: { oauthId },
            orderBy: { createdAt: 'desc' },
        });
    }

    // Get preferences for a specific user + agent
    async findByOauthIdAndAgent(oauthId: string, agentName: AgentName): Promise<UserPreference> {
        const preference = await this.prisma.userPreference.findUnique({
            where: {
                oauthId_agentName: {
                    oauthId,
                    agentName,
                },
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
        // Verify it exists
        await this.findByOauthIdAndAgent(oauthId, agentName);

        return this.prisma.userPreference.update({
            where: {
                oauthId_agentName: {
                    oauthId,
                    agentName,
                },
            },
            data,
        });
    }

    // Upsert preferences (create if not exists, update if exists)
    async upsertByOauthIdAndAgent(
        oauthId: string,
        agentName: AgentName,
        data: UpdateUserPreferenceDto,
    ): Promise<UserPreference> {
        return this.prisma.userPreference.upsert({
            where: {
                oauthId_agentName: {
                    oauthId,
                    agentName,
                },
            },
            create: {
                oauthId,
                agentName,
                ...data,
            },
            update: data,
        });
    }

    // Delete preferences for a user + agent
    async deleteByOauthIdAndAgent(oauthId: string, agentName: AgentName): Promise<void> {
        await this.findByOauthIdAndAgent(oauthId, agentName);

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
    async getOrCreateDefault(oauthId: string, agentName: AgentName): Promise<UserPreference> {
        const existing = await this.prisma.userPreference.findUnique({
            where: {
                oauthId_agentName: {
                    oauthId,
                    agentName,
                },
            },
        });

        if (existing) {
            return existing;
        }

        // Create with default values (Prisma will use schema defaults)
        return this.prisma.userPreference.create({
            data: {
                oauthId,
                agentName,
            },
        });
    }
}
