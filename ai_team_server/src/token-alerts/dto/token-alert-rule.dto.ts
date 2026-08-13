import { TokenAlertLevel, TokenAlertScope } from 'src/generated/prisma/client';

export class CreateTokenAlertRuleDto {
  scope?: TokenAlertScope;
  thresholdPercent!: number;
  level!: TokenAlertLevel;
  message!: string;
  isActive?: boolean;
  sortOrder?: number;
}

export class UpdateTokenAlertRuleDto {
  scope?: TokenAlertScope;
  thresholdPercent?: number;
  level?: TokenAlertLevel;
  message?: string;
  isActive?: boolean;
  sortOrder?: number;
}

/** One rule inside a bulk save. `id` is optional: present = update, absent = create. */
export class SyncTokenAlertRuleItemDto {
  id?: string;
  thresholdPercent!: number;
  level!: TokenAlertLevel;
  message!: string;
  isActive?: boolean;
  sortOrder?: number;
}

/** Payload behind the admin panel's "Save Alerts" button. */
export class SyncTokenAlertRulesDto {
  scope?: TokenAlertScope;
  rules!: SyncTokenAlertRuleItemDto[];
}
