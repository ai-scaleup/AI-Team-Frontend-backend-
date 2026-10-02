import { authenticatedFetch } from "@/lib/authenticatedFetch";

import { API_BASE } from "@/lib/apiBase";

/** The tier a chat draws its tokens from, as n8n receives it in `metadata.tokenType`. */
export type TokenType = "single-agent" | "team" | "membership";

export interface AgentTokenSource {
  /** Tier in use right now; null when every tier the user holds is used up. */
  tokenType: TokenType | null;
  /** Figures of the grant in use (or of the last exhausted one), for the usage bar. */
  tokenLimit: number;
  usedTokens: number;
  tokensLeft: number;
  /** Id of the grant in use, so a caller can tell n8n exactly which one it is. */
  grantId: string | null;
  /** Team tier only: the AgentTeam id the team token-usage endpoint is keyed on. */
  teamId: string | null;
  /** False when the user holds no grant with a token limit at all (access only). */
  hasLimitedGrant: boolean;
}

type Grant = {
  id: string;
  tokenLimit: number | null;
  usedTokens: number;
  tokensLeft: number | null;
  teamId?: string;
};

const listFrom = <T,>(payload: unknown): T[] =>
  Array.isArray(payload) ? (payload as T[]) : ((payload as { data?: T[] })?.data ?? []);

const getJson = async (url: string, signal?: AbortSignal) => {
  const res = await authenticatedFetch(url, { cache: "no-store", signal });
  return res.ok ? res.json() : null;
};

/**
 * Works out which tier pays for the next chat with `agentName` (the backend
 * enum, e.g. "ALEX"). Tiers are tried in order -- the single-agent grant, then
 * the agent's slice of a team grant, then a membership's shared pool -- and
 * the first one with tokens left wins. A grant without a limit is access only
 * and never pays.
 */
export async function resolveAgentTokenSource(
  email: string,
  agentName: string,
  signal?: AbortSignal,
): Promise<AgentTokenSource> {
  const q = `email=${encodeURIComponent(email)}&activeOnly=true`;

  const [singlePayload, teamPayload, membershipPayload] = await Promise.all([
    getJson(`${API_BASE}/admin/single-agent-assignments?${q}&agentName=${agentName}&limit=200`, signal),
    getJson(`${API_BASE}/admin/team-assignments?${q}&limit=200`, signal),
    getJson(`${API_BASE}/admin/memberships/assignments?${q}`, signal),
  ]);

  const single = listFrom<Grant & { agentName: string }>(singlePayload).filter(
    (g) => g.agentName === agentName,
  );

  const team = listFrom<{
    teamId?: string;
    agents?: (Grant & { agentName: string })[];
    team?: { isActive: boolean; agents: string[] };
  }>(teamPayload)
    .filter((g) => g.team?.isActive !== false && g.team?.agents?.includes(agentName))
    .flatMap((g) =>
      (g.agents ?? []).filter((a) => a.agentName === agentName).map((a) => ({ ...a, teamId: g.teamId })),
    );

  const membership = listFrom<{
    id: string;
    agents: string[];
    monthlyTokenLimit: number | null;
    usedTokens: number;
    tokensLeft: number | null;
  }>(membershipPayload)
    .filter((m) => m.agents?.includes(agentName))
    .map((m) => ({ id: m.id, tokenLimit: m.monthlyTokenLimit, usedTokens: m.usedTokens, tokensLeft: m.tokensLeft }));

  const tiers: [TokenType, Grant[]][] = [
    ["single-agent", single],
    ["team", team],
    ["membership", membership],
  ];

  let lastExhausted: Grant | null = null;
  for (const [tokenType, grants] of tiers) {
    for (const grant of grants) {
      if (grant.tokenLimit === null || grant.tokenLimit === undefined) continue;
      const tokensLeft = grant.tokensLeft ?? Math.max(0, grant.tokenLimit - grant.usedTokens);
      if (tokensLeft > 0) {
        return {
          tokenType,
          tokenLimit: grant.tokenLimit,
          usedTokens: grant.usedTokens,
          tokensLeft,
          grantId: grant.id,
          teamId: tokenType === "team" ? grant.teamId ?? null : null,
          hasLimitedGrant: true,
        };
      }
      lastExhausted = grant;
    }
  }

  return {
    tokenType: null,
    tokenLimit: lastExhausted?.tokenLimit ?? 0,
    usedTokens: lastExhausted?.usedTokens ?? 0,
    tokensLeft: 0,
    grantId: null,
    teamId: null,
    hasLimitedGrant: lastExhausted !== null,
  };
}

export const TOKEN_TYPE_LABELS: Record<TokenType, string> = {
  "single-agent": "Agente singolo",
  team: "Team",
  membership: "Membership",
};
