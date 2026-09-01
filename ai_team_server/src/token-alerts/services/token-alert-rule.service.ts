import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiModel,
  TokenAlertLevel,
  TokenAlertScope,
} from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  API_MODEL_BY_MODEL_ID,
  API_MODEL_CATALOG,
  API_MODEL_IDS,
  API_MODEL_LABELS,
  API_MODEL_PROVIDER,
} from '../constants/api-models';
import {
  CreateTokenAlertRuleDto,
  SyncTokenAlertRuleItemDto,
  SyncTokenAlertRulesDto,
  UpdateTokenAlertRuleDto,
  UpdateTokenAlertSettingsDto,
} from '../dto/token-alert-rule.dto';

const LEVELS = Object.values(TokenAlertLevel) as TokenAlertLevel[];
const SCOPES = Object.values(TokenAlertScope) as TokenAlertScope[];

const MESSAGE_MAX_LENGTH = 500;

const API_MODELS = Object.values(ApiModel) as ApiModel[];

// A conversation allowance well past any real context window is still a
// typo guard -- it keeps a stray paste from writing a nonsensical row.
const TOKEN_LIMIT_MAX = 100_000_000;

const DEFAULT_API_MODEL = ApiModel.GPT_4O_MINI;

@Injectable()
export class TokenAlertRuleService {
  constructor(private readonly prisma: PrismaService) {}

  private parseScope(value: unknown, fallback: TokenAlertScope): TokenAlertScope {
    if (value === undefined || value === null || value === '') return fallback;
    const scope = String(value).toUpperCase() as TokenAlertScope;
    if (!SCOPES.includes(scope)) {
      throw new BadRequestException(
        `scope must be one of: ${SCOPES.join(', ')}`,
      );
    }
    return scope;
  }

  private parseLevel(value: unknown): TokenAlertLevel {
    const level = String(value ?? '').toUpperCase() as TokenAlertLevel;
    if (!LEVELS.includes(level)) {
      throw new BadRequestException(
        `level must be one of: ${LEVELS.join(', ')}`,
      );
    }
    return level;
  }

  private parseThreshold(value: unknown): number {
    const threshold = typeof value === 'string' ? Number(value) : value;
    if (
      typeof threshold !== 'number' ||
      !Number.isInteger(threshold) ||
      threshold < 1 ||
      threshold > 100
    ) {
      throw new BadRequestException(
        'thresholdPercent must be an integer between 1 and 100',
      );
    }
    return threshold;
  }

  private parseMessage(value: unknown): string {
    const message = typeof value === 'string' ? value.trim() : '';
    if (!message) throw new BadRequestException('message is required');
    if (message.length > MESSAGE_MAX_LENGTH) {
      throw new BadRequestException(
        `message must be ${MESSAGE_MAX_LENGTH} characters or fewer`,
      );
    }
    return message;
  }

  /**
   * Accepts either the enum value (`GPT_4O_MINI`) or the provider model id
   * (`gpt-4o-mini`), so the admin panel may send whichever it holds.
   */
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

  private parseTokenLimit(value: unknown): number {
    const limit = typeof value === 'string' ? Number(value) : value;
    if (
      typeof limit !== 'number' ||
      !Number.isInteger(limit) ||
      limit < 0 ||
      limit > TOKEN_LIMIT_MAX
    ) {
      throw new BadRequestException(
        `tokenLimit must be an integer between 0 and ${TOKEN_LIMIT_MAX}`,
      );
    }
    return limit;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === 'P2002'
    );
  }

  private duplicateThresholdError(scope: TokenAlertScope, threshold: number) {
    return new ConflictException(
      `A ${scope} alert rule for ${threshold}% already exists`,
    );
  }

  async listRules(scope?: unknown, isActive?: unknown) {
    const where: {
      scope?: TokenAlertScope;
      isActive?: boolean;
    } = {};

    if (scope !== undefined && scope !== null && scope !== '') {
      where.scope = this.parseScope(scope, TokenAlertScope.CONVERSATION);
    }

    if (isActive !== undefined && isActive !== null && isActive !== '') {
      const raw = String(isActive).toLowerCase();
      if (raw !== 'true' && raw !== 'false') {
        throw new BadRequestException('isActive must be true or false');
      }
      where.isActive = raw === 'true';
    }

    return this.prisma.tokenUsageAlertRule.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { thresholdPercent: 'asc' }],
    });
  }

  async getRule(id: string) {
    const rule = await this.prisma.tokenUsageAlertRule.findUnique({
      where: { id },
    });
    if (!rule) throw new NotFoundException('Token alert rule not found');
    return rule;
  }

  async createRule(data: CreateTokenAlertRuleDto) {
    const scope = this.parseScope(data.scope, TokenAlertScope.CONVERSATION);
    const thresholdPercent = this.parseThreshold(data.thresholdPercent);

    try {
      return await this.prisma.tokenUsageAlertRule.create({
        data: {
          scope,
          thresholdPercent,
          level: this.parseLevel(data.level),
          message: this.parseMessage(data.message),
          isActive: data.isActive ?? true,
          sortOrder: data.sortOrder ?? thresholdPercent,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw this.duplicateThresholdError(scope, thresholdPercent);
      }
      throw error;
    }
  }

  async updateRule(id: string, data: UpdateTokenAlertRuleDto) {
    const existing = await this.getRule(id);

    const scope =
      data.scope === undefined
        ? existing.scope
        : this.parseScope(data.scope, existing.scope);
    const thresholdPercent =
      data.thresholdPercent === undefined
        ? existing.thresholdPercent
        : this.parseThreshold(data.thresholdPercent);

    try {
      return await this.prisma.tokenUsageAlertRule.update({
        where: { id },
        data: {
          scope,
          thresholdPercent,
          level:
            data.level === undefined ? undefined : this.parseLevel(data.level),
          message:
            data.message === undefined
              ? undefined
              : this.parseMessage(data.message),
          isActive: data.isActive,
          sortOrder: data.sortOrder,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw this.duplicateThresholdError(scope, thresholdPercent);
      }
      throw error;
    }
  }

  async deleteRule(id: string) {
    await this.getRule(id);
    return this.prisma.tokenUsageAlertRule.delete({ where: { id } });
  }

  /**
   * Bulk save for the admin panel. Rules are matched by id, so anything the
   * admin removed from the list is deleted — but only within `scope`, and only
   * rows in this table. Nothing else in the database is touched.
   */
  async syncRules(payload: SyncTokenAlertRulesDto) {
    const scope = this.parseScope(payload?.scope, TokenAlertScope.CONVERSATION);

    const hasSettings =
      (payload?.tokenLimit !== undefined && payload.tokenLimit !== null) ||
      (payload?.apiModel !== undefined &&
        payload.apiModel !== null &&
        payload.apiModel !== '');

    // Fail on a bad limit or model before any rule is written, so a rejected
    // save leaves the whole panel as it was.
    if (hasSettings) {
      if (payload.tokenLimit !== undefined && payload.tokenLimit !== null) {
        this.parseTokenLimit(payload.tokenLimit);
      }
      if (payload.apiModel !== undefined && payload.apiModel !== null && payload.apiModel !== '') {
        this.parseApiModel(payload.apiModel);
      }
    }

    if (!Array.isArray(payload?.rules)) {
      throw new BadRequestException('rules must be an array');
    }

    const normalized = payload.rules.map(
      (rule: SyncTokenAlertRuleItemDto, index: number) => ({
        id: typeof rule?.id === 'string' && rule.id ? rule.id : undefined,
        thresholdPercent: this.parseThreshold(rule?.thresholdPercent),
        level: this.parseLevel(rule?.level),
        message: this.parseMessage(rule?.message),
        isActive: rule?.isActive ?? true,
        sortOrder: rule?.sortOrder ?? index + 1,
      }),
    );

    const thresholds = new Set<number>();
    for (const rule of normalized) {
      if (thresholds.has(rule.thresholdPercent)) {
        throw new ConflictException(
          `Duplicate threshold ${rule.thresholdPercent}% in payload`,
        );
      }
      thresholds.add(rule.thresholdPercent);
    }

    const existing = await this.prisma.tokenUsageAlertRule.findMany({
      where: { scope },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((rule) => rule.id));

    for (const rule of normalized) {
      if (rule.id && !existingIds.has(rule.id)) {
        throw new NotFoundException(
          `Token alert rule ${rule.id} does not exist in scope ${scope}`,
        );
      }
    }

    const keptIds = new Set(
      normalized.map((rule) => rule.id).filter((id): id is string => !!id),
    );
    const removedIds = [...existingIds].filter((id) => !keptIds.has(id));

    try {
      await this.prisma.$transaction([
        ...(removedIds.length
          ? [
              this.prisma.tokenUsageAlertRule.deleteMany({
                where: { id: { in: removedIds }, scope },
              }),
            ]
          : []),
        ...normalized.map((rule) =>
          rule.id
            ? this.prisma.tokenUsageAlertRule.update({
                where: { id: rule.id },
                data: {
                  scope,
                  thresholdPercent: rule.thresholdPercent,
                  level: rule.level,
                  message: rule.message,
                  isActive: rule.isActive,
                  sortOrder: rule.sortOrder,
                },
              })
            : this.prisma.tokenUsageAlertRule.create({
                data: {
                  scope,
                  thresholdPercent: rule.thresholdPercent,
                  level: rule.level,
                  message: rule.message,
                  isActive: rule.isActive,
                  sortOrder: rule.sortOrder,
                },
              }),
        ),
      ]);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          `Two ${scope} alert rules cannot share the same threshold`,
        );
      }
      throw error;
    }

    const settings = hasSettings
      ? await this.updateSettings({
          scope,
          tokenLimit: payload.tokenLimit,
          apiModel: payload.apiModel,
        })
      : await this.getSettings(scope);

    return {
      scope,
      created: normalized.filter((rule) => !rule.id).length,
      updated: keptIds.size,
      deleted: removedIds.length,
      settings,
      rules: await this.listRules(scope),
    };
  }

  /** Shapes a settings row for the API, resolving the provider model id. */
  private serializeSettings(settings: {
    id: string;
    scope: TokenAlertScope;
    tokenLimit: number;
    apiModel: ApiModel;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...settings,
      apiModelId: API_MODEL_IDS[settings.apiModel],
      apiModelLabel: API_MODEL_LABELS[settings.apiModel],
      apiProvider: API_MODEL_PROVIDER,
    };
  }

  /**
   * Panel settings for one scope. The row is created on first read rather
   * than 404ing, so a fresh install still answers with the defaults.
   */
  async getSettings(scope?: unknown) {
    const parsedScope = this.parseScope(scope, TokenAlertScope.CONVERSATION);

    const existing = await this.prisma.tokenAlertSettings.findUnique({
      where: { scope: parsedScope },
    });
    if (existing) return this.serializeSettings(existing);

    const created = await this.prisma.tokenAlertSettings.create({
      data: { scope: parsedScope, tokenLimit: 0, apiModel: DEFAULT_API_MODEL },
    });
    return this.serializeSettings(created);
  }

  /** Every scope's settings, for an admin panel that renders them together. */
  async listSettings() {
    return Promise.all(SCOPES.map((scope) => this.getSettings(scope)));
  }

  /**
   * Writes the token limit and/or the model for one scope. Fields left out
   * of the payload keep their stored value -- nothing is cleared.
   */
  async updateSettings(payload: UpdateTokenAlertSettingsDto) {
    const scope = this.parseScope(payload?.scope, TokenAlertScope.CONVERSATION);

    const tokenLimit =
      payload?.tokenLimit === undefined || payload.tokenLimit === null
        ? undefined
        : this.parseTokenLimit(payload.tokenLimit);
    const apiModel =
      payload?.apiModel === undefined ||
      payload.apiModel === null ||
      payload.apiModel === ''
        ? undefined
        : this.parseApiModel(payload.apiModel);

    if (tokenLimit === undefined && apiModel === undefined) {
      throw new BadRequestException(
        'Provide tokenLimit and/or apiModel to update',
      );
    }

    const settings = await this.prisma.tokenAlertSettings.upsert({
      where: { scope },
      update: { tokenLimit, apiModel },
      create: {
        scope,
        tokenLimit: tokenLimit ?? 0,
        apiModel: apiModel ?? DEFAULT_API_MODEL,
      },
    });
    return this.serializeSettings(settings);
  }

  /** The model dropdown's options. OpenAI only for now. */
  listApiModels() {
    return API_MODEL_CATALOG;
  }
}
