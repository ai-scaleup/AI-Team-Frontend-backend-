// src/common/agent-slug.ts
import { AgentName } from 'src/generated/prisma/client';

/**
 * Conversations record their agent as the frontend's slug ("mike-ai"), while
 * assignments and groups record the AgentName enum ("MIKE"). Anything that has
 * to line the two up — a team's per-conversation token allowance reaching the
 * chats held with that team's agents — needs this translation.
 *
 * The slug is the enum lowercased with underscores turned into dashes and an
 * "-ai" suffix. Agents whose enum already carries the suffix (SARA_AI) keep a
 * single one, which is what AGENT_ID_TO_NAME on the frontend spells out.
 */
export function agentNameToConversationAgentId(name: AgentName): string {
  const slug = name.toLowerCase().replace(/_/g, '-');
  return slug.endsWith('-ai') ? slug : `${slug}-ai`;
}

/** Slugs for a set of agents, deduped and order-preserving. */
export function agentNamesToConversationAgentIds(
  names: readonly AgentName[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const id = agentNameToConversationAgentId(name);
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** Built from the enum itself, so a new agent needs no second edit here. */
const AGENT_ID_TO_NAME: ReadonlyMap<string, AgentName> = new Map(
  Object.values(AgentName).map(
    (name) => [agentNameToConversationAgentId(name), name] as const,
  ),
);

/**
 * Reverse lookup. Returns null for a slug no agent claims — conversations are
 * free-text on agentId, so an unknown value is a miss rather than an error.
 */
export function conversationAgentIdToAgentName(
  agentId: string,
): AgentName | null {
  return AGENT_ID_TO_NAME.get(agentId.trim().toLowerCase()) ?? null;
}
