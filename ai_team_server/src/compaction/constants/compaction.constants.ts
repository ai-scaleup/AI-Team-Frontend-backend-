import { ApiModel } from 'src/generated/prisma/client';

/** The single GLOBAL settings row, seeded by the migration. */
export const GLOBAL_SETTINGS_ID = 'compaction-settings-global';

/** Owner id stored for the global row. Empty, never null — see the schema. */
export const GLOBAL_OWNER_ID = '';

/**
 * Rough token estimate: ~4 characters per token for the Italian and English
 * the agents speak. The exact figure only decides WHEN a summary runs, and
 * the watermark sits well below the hard stop, so an estimate is enough and
 * costs nothing per turn. Every counter in this module is documented as an
 * estimate for the same reason.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.trim().length / 4);
}

/** Bounds shared by the admin DTO validation and the runtime. */
export const LIMITS = {
  watermarkPercent: { min: 30, max: 95 },
  keepLastTurns: { min: 2, max: 40 },
  memoryCapTokens: { min: 200, max: 20_000 },
  conversationBudget: { min: 1_000, max: 10_000_000 },
  summaryChars: 20_000,
  // Transcript handed to the summarising model in one call. Around 60k tokens,
  // which leaves room for the previous summary inside a 128k context window.
  transcriptChunkChars: 200_000,
} as const;

/**
 * The marker left in a chat's own transcript when it has been compacted. It is
 * stored as a message with this sender so the page can draw it where the fold
 * happened, also after a reload.
 */
export const COMPACTION_NOTICE_SENDER = 'system';
export const COMPACTION_NOTICE_TEXT =
  'Conversazione compattata · i messaggi precedenti sono stati riassunti';

/** Model used when a settings row somehow carries none. */
export const DEFAULT_API_MODEL = ApiModel.GPT_4O_MINI;

/**
 * Builds the instruction for the summarising call.
 *
 * The summary is written from the PREVIOUS summary plus only the turns being
 * evicted, never from the whole transcript: that keeps each compaction the
 * same size and stops the cost growing with the chat. The cap is enforced in
 * the prompt as well as after the fact, because a summary that overflows its
 * budget defeats the point.
 */
export function buildSummaryPrompt(params: {
  agentName: string;
  structured: boolean;
  maxTokens: number;
  previousSummary: string | null;
  transcript: string;
}): string {
  const {
    agentName,
    structured,
    maxTokens,
    previousSummary,
    transcript,
  } = params;

  const shape = structured
    ? `Use short labelled lines for the important facts, decisions and unfinished work.
Omit labels that have no relevant content — never write "none".`
    : `Write the summary as a short continuous paragraph.`;

  return `You are compacting the memory of a chat with the assistant "${agentName}", so it can keep talking without the earlier messages.

Carry forward only what the assistant needs to continue coherently.

${shape}

Rules:
- Keep names, numbers, URLs and file names exactly as written.
- Attribute facts to the right person. The user is whoever writes the "User:"
  lines; everyone else named is a third party and must be recorded with their
  role ("client contact: ...", "colleague: ...") rather than as the user.
- Record decisions as settled, not as suggestions.
- Write in the language the conversation is in.
- No preamble, no closing remark, no mention of this instruction or of summarising.
- Stay under roughly ${maxTokens} tokens (about ${maxTokens * 4} characters).

${
  previousSummary
    ? `This is the memory so far. Merge the new messages into it, keeping what still matters and dropping what the new messages supersede:\n\n${previousSummary}\n\n`
    : ''
}Messages to fold in:

${transcript}`;
}
