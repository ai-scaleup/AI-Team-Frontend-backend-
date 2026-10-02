import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AgentName,
  ApiModel,
  CompactionOwnerType,
  CompactionSettings,
  CompactionSummaryStyle,
  TokenAlertScope,
} from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  API_MODEL_BY_MODEL_ID,
  API_MODEL_CATALOG,
} from 'src/token-alerts/constants/api-models';
import {
  DEFAULT_API_MODEL,
  GLOBAL_OWNER_ID,
  GLOBAL_SETTINGS_ID,
  LIMITS,
} from '../constants/compaction.constants';
import {
  CreateCompactionOverrideDto,
  UpdateCompactionSettingsDto,
} from '../dto/compaction.dto';

const API_MODELS = Object.values(ApiModel) as ApiModel[];
const OWNER_TYPES = Object.values(CompactionOwnerType) as CompactionOwnerType[];
const SUMMARY_STYLES = Object.values(
  CompactionSummaryStyle,
) as CompactionSummaryStyle[];
const AGENT_NAMES = Object.values(AgentName) as AgentName[];

/** A resolved settings row plus where it came from, for the runtime to log. */
export interface ResolvedCompactionSettings {
  settings: CompactionSettings;
  ownerType: CompactionOwnerType;
  ownerId: string;
  ownerLabel: string;
  /** Budget the watermark is measured against, in tokens. */
  conversationBudget: number;
}

@Injectable()
export class CompactionSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────
  // Parsing
  // ─────────────────────────────────────────────────────────────

  private parseInt(
    value: unknown,
    field: keyof typeof LIMITS,
    bounds: { min: number; max: number },
  ): number {
    const parsed = typeof value === 'string' ? Number(value) : value;
    if (
      typeof parsed !== 'number' ||
      !Number.isInteger(parsed) ||
      parsed < bounds.min ||
      parsed > bounds.max
    ) {
      throw new BadRequestException(
        `${String(field)} must be an integer between ${bounds.min} and ${bounds.max}`,
      );
    }
    return parsed;
  }

  private parseBoolean(value: unknown, field: string): boolean {
    if (typeof value === 'boolean') return value;
    const raw = String(value).toLowerCase();
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    throw new BadRequestException(`${field} must be true or false`);
  }

  private parseSummaryStyle(value: unknown): CompactionSummaryStyle {
    const style = String(value ?? '').toUpperCase() as CompactionSummaryStyle;
    if (!SUMMARY_STYLES.includes(style)) {
      throw new BadRequestException(
        `summaryStyle must be one of: ${SUMMARY_STYLES.join(', ')}`,
      );
    }
    return style;
  }

  /** Accepts the enum value or the provider model id, as token-alerts does. */
  private parseApiModel(value: unknown): ApiModel {
    const raw = String(value ?? '').trim();
    const asEnum = raw.toUpperCase().replace(/[-.]/g, '_') as ApiModel;
    if (API_MODELS.includes(asEnum)) return asEnum;

    const byModelId = API_MODEL_BY_MODEL_ID.get(raw.toLowerCase());
    if (byModelId) return byModelId;

    throw new BadRequestException(
      `apiModel must be one of: ${API_MODELS.join(', ')}`,
    );
  }

  private parseOwnerType(value: unknown): CompactionOwnerType {
    const type = String(value ?? '').toUpperCase() as CompactionOwnerType;
    if (!OWNER_TYPES.includes(type)) {
      throw new BadRequestException(
        `ownerType must be one of: ${OWNER_TYPES.join(', ')}`,
      );
    }
    return type;
  }

  /** Shared by the settings patch and the override create/patch. */
  private parseWritableFields(payload: UpdateCompactionSettingsDto) {
    return {
      enabled:
        payload.enabled === undefined
          ? undefined
          : this.parseBoolean(payload.enabled, 'enabled'),
      watermarkPercent:
        payload.watermarkPercent === undefined
          ? undefined
          : this.parseInt(
              payload.watermarkPercent,
              'watermarkPercent',
              LIMITS.watermarkPercent,
            ),
      keepLastTurns:
        payload.keepLastTurns === undefined
          ? undefined
          : this.parseInt(
              payload.keepLastTurns,
              'keepLastTurns',
              LIMITS.keepLastTurns,
            ),
      memoryCapTokens:
        payload.memoryCapTokens === undefined
          ? undefined
          : this.parseInt(
              payload.memoryCapTokens,
              'memoryCapTokens',
              LIMITS.memoryCapTokens,
            ),
      conversationBudget:
        payload.conversationBudget === undefined
          ? undefined
          : this.parseInt(
              payload.conversationBudget,
              'conversationBudget',
              LIMITS.conversationBudget,
            ),
      summaryStyle:
        payload.summaryStyle === undefined
          ? undefined
          : this.parseSummaryStyle(payload.summaryStyle),
      apiModel:
        payload.apiModel === undefined || payload.apiModel === ''
          ? undefined
          : this.parseApiModel(payload.apiModel),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Global settings
  // ─────────────────────────────────────────────────────────────

  /**
   * The global defaults. Created on first read rather than 404ing, so a
   * database that has not run the seed still answers.
   */
  async getGlobalSettings(): Promise<CompactionSettings> {
    const existing = await this.prisma.compactionSettings.findUnique({
      where: {
        ownerType_ownerId: {
          ownerType: CompactionOwnerType.GLOBAL,
          ownerId: GLOBAL_OWNER_ID,
        },
      },
    });
    if (existing) return existing;

    return this.prisma.compactionSettings.create({
      data: {
        id: GLOBAL_SETTINGS_ID,
        ownerType: CompactionOwnerType.GLOBAL,
        ownerId: GLOBAL_OWNER_ID,
      },
    });
  }

  async updateGlobalSettings(
    payload: UpdateCompactionSettingsDto,
  ): Promise<CompactionSettings> {
    const current = await this.getGlobalSettings();
    const data = this.parseWritableFields(payload ?? {});

    if (Object.values(data).every((value) => value === undefined)) {
      throw new BadRequestException('Provide at least one field to update');
    }

    return this.prisma.compactionSettings.update({
      where: { id: current.id },
      data,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Per-package overrides
  // ─────────────────────────────────────────────────────────────

  /** Resolves a display name for an override row, for the admin table. */
  private async labelForOwner(
    ownerType: CompactionOwnerType,
    ownerId: string,
  ): Promise<string> {
    if (ownerType === CompactionOwnerType.GLOBAL) return 'Global defaults';
    if (ownerType === CompactionOwnerType.AGENT) return ownerId;

    if (ownerType === CompactionOwnerType.MEMBERSHIP) {
      const template = await this.prisma.membershipTemplate.findUnique({
        where: { id: ownerId },
        select: { name: true },
      });
      return template?.name ?? 'Deleted membership';
    }

    const team = await this.prisma.agentTeam.findUnique({
      where: { id: ownerId },
      select: { name: true },
    });
    return team?.name ?? 'Deleted team';
  }

  /** Rejects an owner id that names nothing, so the table cannot fill with ghosts. */
  private async assertOwnerExists(
    ownerType: CompactionOwnerType,
    ownerId: string,
  ): Promise<void> {
    if (ownerType === CompactionOwnerType.GLOBAL) {
      throw new BadRequestException(
        'The global row is edited through /admin/compaction/settings',
      );
    }

    if (ownerType === CompactionOwnerType.AGENT) {
      if (!AGENT_NAMES.includes(ownerId as AgentName)) {
        throw new BadRequestException(
          `ownerId must be an AgentName for an AGENT override`,
        );
      }
      return;
    }

    if (ownerType === CompactionOwnerType.MEMBERSHIP) {
      const template = await this.prisma.membershipTemplate.findUnique({
        where: { id: ownerId },
        select: { id: true },
      });
      if (!template)
        throw new NotFoundException('Membership template not found');
      return;
    }

    const team = await this.prisma.agentTeam.findUnique({
      where: { id: ownerId },
      select: { id: true },
    });
    if (!team) throw new NotFoundException('Agent team not found');
  }

  async listOverrides() {
    const rows = await this.prisma.compactionSettings.findMany({
      where: { ownerType: { not: CompactionOwnerType.GLOBAL } },
      orderBy: [{ ownerType: 'asc' }, { createdAt: 'asc' }],
    });

    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        ownerLabel: await this.labelForOwner(row.ownerType, row.ownerId),
      })),
    );
  }

  async createOverride(payload: CreateCompactionOverrideDto) {
    const ownerType = this.parseOwnerType(payload?.ownerType);
    const ownerId = String(payload?.ownerId ?? '').trim();
    if (!ownerId) throw new BadRequestException('ownerId is required');

    await this.assertOwnerExists(ownerType, ownerId);

    const global = await this.getGlobalSettings();
    const overrides = this.parseWritableFields(payload ?? {});

    // A new override starts as a copy of the global defaults, so the admin
    // only has to change what should differ.
    try {
      return await this.prisma.compactionSettings.create({
        data: {
          ownerType,
          ownerId,
          enabled: overrides.enabled ?? global.enabled,
          watermarkPercent:
            overrides.watermarkPercent ?? global.watermarkPercent,
          keepLastTurns: overrides.keepLastTurns ?? global.keepLastTurns,
          memoryCapTokens: overrides.memoryCapTokens ?? global.memoryCapTokens,
          conversationBudget:
            overrides.conversationBudget ?? global.conversationBudget,
          summaryStyle: overrides.summaryStyle ?? global.summaryStyle,
          apiModel: overrides.apiModel ?? global.apiModel,
        },
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException(
          'This package already has a compaction override',
        );
      }
      throw error;
    }
  }

  async updateOverride(id: string, payload: UpdateCompactionSettingsDto) {
    const existing = await this.prisma.compactionSettings.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Compaction override not found');
    if (existing.ownerType === CompactionOwnerType.GLOBAL) {
      throw new BadRequestException(
        'The global row is edited through /admin/compaction/settings',
      );
    }

    const data = this.parseWritableFields(payload ?? {});
    if (Object.values(data).every((value) => value === undefined)) {
      throw new BadRequestException('Provide at least one field to update');
    }

    return this.prisma.compactionSettings.update({
      where: { id },
      data,
    });
  }

  async deleteOverride(id: string) {
    const existing = await this.prisma.compactionSettings.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Compaction override not found');
    if (existing.ownerType === CompactionOwnerType.GLOBAL) {
      throw new BadRequestException(
        'The global settings row cannot be deleted',
      );
    }
    return this.prisma.compactionSettings.delete({ where: { id } });
  }

  /**
   * Everything an admin can attach an override to, for the picker. Agents
   * already carrying one are still listed; the create call is what rejects a
   * duplicate.
   */
  async listOwnerOptions() {
    const [memberships, teams] = await Promise.all([
      this.prisma.membershipTemplate.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.agentTeam.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      MEMBERSHIP: memberships.map((row) => ({ id: row.id, name: row.name })),
      TEAM: teams.map((row) => ({ id: row.id, name: row.name })),
      AGENT: AGENT_NAMES.map((name) => ({ id: name, name })),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Runtime resolution
  // ─────────────────────────────────────────────────────────────

  /**
   * The per-conversation allowance the watermark is measured against.
   *
   * The settings row's own budget wins when it carries one, so what an admin
   * types into the panel is what the watermark uses. Zero means "inherit",
   * following the same convention as TokenAlertSettings.tokenLimit, and falls
   * back to the platform's conversation limit — the number the announcer bar
   * already counts down — rather than to a second invented figure.
   */
  private async resolveConversationBudget(
    settings: CompactionSettings,
  ): Promise<number> {
    if (settings.conversationBudget > 0) return settings.conversationBudget;

    const alertSettings = await this.prisma.tokenAlertSettings.findUnique({
      where: { scope: TokenAlertScope.CONVERSATION },
      select: { tokenLimit: true },
    });
    return alertSettings?.tokenLimit ?? 0;
  }

  private async findOverride(
    ownerType: CompactionOwnerType,
    ownerId: string,
  ): Promise<CompactionSettings | null> {
    return this.prisma.compactionSettings.findUnique({
      where: { ownerType_ownerId: { ownerType, ownerId } },
    });
  }

  /**
   * Which settings apply to this user and agent.
   *
   * Membership beats team beats single agent beats the global defaults —
   * the precedence the admin blueprint settled on, so a user holding several
   * packages that reach the same agent gets one predictable answer instead of
   * whichever query ran last.
   */
  async resolveForChat(params: {
    agentName: AgentName;
    email?: string | null;
  }): Promise<ResolvedCompactionSettings> {
    const { agentName } = params;
    const email = params.email?.trim().toLowerCase() || null;

    const finish = async (
      settings: CompactionSettings,
    ): Promise<ResolvedCompactionSettings> => {
      return {
        settings,
        ownerType: settings.ownerType,
        ownerId: settings.ownerId,
        ownerLabel: await this.labelForOwner(
          settings.ownerType,
          settings.ownerId,
        ),
        conversationBudget: await this.resolveConversationBudget(settings),
      };
    };

    const user = email
      ? await this.prisma.user.findUnique({
          where: { email },
          select: { id: true },
        })
      : null;

    if (user) {
      const now = new Date();

      // 1. Membership. The template reaches the agent either directly or
      //    through one of its bundled teams.
      const memberships = await this.prisma.assignedMembership.findMany({
        where: {
          userId: user.id,
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: {
          membershipTemplateId: true,
          template: {
            select: {
              includedAgents: true,
              includedTeams: {
                select: {
                  team: { select: { agents: { select: { agentName: true } } } },
                },
              },
            },
          },
        },
      });

      for (const membership of memberships) {
        const direct = membership.template.includedAgents.includes(agentName);
        const viaTeam = membership.template.includedTeams.some((link) =>
          link.team.agents.some((agent) => agent.agentName === agentName),
        );
        if (!direct && !viaTeam) continue;

        const override = await this.findOverride(
          CompactionOwnerType.MEMBERSHIP,
          membership.membershipTemplateId,
        );
        if (override) return finish(override);
      }

      // 2. Team.
      const teamGrants = await this.prisma.assignedTeam.findMany({
        where: {
          userId: user.id,
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          team: { agents: { some: { agentName } } },
        },
        select: { teamId: true },
      });

      for (const grant of teamGrants) {
        const override = await this.findOverride(
          CompactionOwnerType.TEAM,
          grant.teamId,
        );
        if (override) return finish(override);
      }

      // 3. Single agent grant.
      const singleGrant = await this.prisma.singleAssignedAgent.findFirst({
        where: {
          userId: user.id,
          agentName,
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { id: true },
      });
      if (singleGrant) {
        const override = await this.findOverride(
          CompactionOwnerType.AGENT,
          agentName,
        );
        if (override) return finish(override);
      }
    }

    // An AGENT override also applies to a chat the server cannot tie to a
    // user — the test pages talk to n8n without a signed-in identity, and an
    // agent-level rule is still the right rule for them.
    const agentOverride = await this.findOverride(
      CompactionOwnerType.AGENT,
      agentName,
    );
    if (agentOverride) return finish(agentOverride);

    return finish(await this.getGlobalSettings());
  }

  /** The model actually used for summarising. */
  modelFor(settings: CompactionSettings): ApiModel {
    return settings.apiModel ?? DEFAULT_API_MODEL;
  }

  /**
   * The options behind the panel's model dropdown. OpenAI only for now; the
   * catalog is the same one token-alerts uses, so a model added to the enum
   * shows up in both panels without a second list to keep in step.
   */
  listApiModels() {
    return API_MODEL_CATALOG.map((model) => ({
      ...model,
      isDefault: model.value === DEFAULT_API_MODEL,
    }));
  }
}
