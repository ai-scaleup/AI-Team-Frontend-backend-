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
  /** Panel-level token allowance. Omitted leaves the saved value alone. */
  tokenLimit?: number;
  /** Enum value (GPT_4O_MINI) or provider model id (gpt-4o-mini). */
  apiModel?: string;
  rules!: SyncTokenAlertRuleItemDto[];
}

/** Panel-level settings: the token allowance and the model to run on. */
export class UpdateTokenAlertSettingsDto {
  scope?: TokenAlertScope;
  tokenLimit?: number;
  apiModel?: string;
}
