import {
  CompactionOwnerType,
  CompactionSummaryStyle,
} from 'src/generated/prisma/client';

/** Every knob the admin panel can write. All optional: omitted keys are kept. */
export class UpdateCompactionSettingsDto {
  enabled?: boolean;
  watermarkPercent?: number;
  keepLastTurns?: number;
  memoryCapTokens?: number;
  conversationBudget?: number;
  summaryStyle?: CompactionSummaryStyle;
  /** Enum value (GPT_4O_MINI) or provider model id (gpt-4o-mini). */
  apiModel?: string;
}

/** Creates a per-package override. */
export class CreateCompactionOverrideDto {
  ownerType!: CompactionOwnerType;
  /** MembershipTemplate.id, AgentTeam.id, or an AgentName. */
  ownerId!: string;
  enabled?: boolean;
  watermarkPercent?: number;
  keepLastTurns?: number;
  memoryCapTokens?: number;
  conversationBudget?: number;
  summaryStyle?: CompactionSummaryStyle;
  apiModel?: string;
}

/**
 * What an agent workflow asks for before it calls the model: the memory block
 * to put in the system prompt and how many turns to keep verbatim.
 */
export class CompactionContextDto {
  sessionId!: string;
  /** AgentName enum value, or the frontend slug ("tony-ai"). */
  agent!: string;
  chatId?: string;
  email?: string;
  title?: string;
}

/**
 * One completed turn, reported by the workflow after the model answered.
 * The server appends it, then compacts if the chat crossed the watermark.
 */
export class CompactionTurnDto {
  sessionId!: string;
  agent!: string;
  chatId?: string;
  email?: string;
  title?: string;
  userText?: string;
  aiText?: string;
  /**
   * Real usage from the provider, when the caller has it. Omitted, the server
   * estimates from the text — which is all the watermark needs.
   */
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  /**
   * The summary version this turn's message carried to the workflow, when it
   * carried one. Reported only after the workflow answered, so a summary whose
   * message never arrived stays pending.
   */
  deliveredSummaryVersion?: number;
  /** Leave a "compacted" marker in the chat's transcript when this turn compacts. */
  notifyChat?: boolean;
}

/** Identifies the chat whose compaction progress a page is asking about. */
export class CompactionStatusDto {
  sessionId!: string;
  agent!: string;
  chatId?: string;
}
