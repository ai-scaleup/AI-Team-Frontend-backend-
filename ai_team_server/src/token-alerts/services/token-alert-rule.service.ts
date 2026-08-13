import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  TokenAlertLevel,
  TokenAlertScope,
} from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateTokenAlertRuleDto,
  SyncTokenAlertRuleItemDto,
  SyncTokenAlertRulesDto,
  UpdateTokenAlertRuleDto,
} from '../dto/token-alert-rule.dto';

const LEVELS = Object.values(TokenAlertLevel) as TokenAlertLevel[];
const SCOPES = Object.values(TokenAlertScope) as TokenAlertScope[];

const MESSAGE_MAX_LENGTH = 500;

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

    return {
      scope,
      created: normalized.filter((rule) => !rule.id).length,
      updated: keptIds.size,
      deleted: removedIds.length,
      rules: await this.listRules(scope),
    };
  }
}
