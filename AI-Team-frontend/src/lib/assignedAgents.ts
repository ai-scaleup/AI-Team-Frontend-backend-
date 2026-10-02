import { authenticatedFetch } from "@/lib/authenticatedFetch";

import { API_BASE } from "@/lib/apiBase";

export interface AssignedTeam {
  id: string
  userId: string
  teamId: string
  startsAt: string
  expiresAt: string | null
  durationDays: number | null
  isActive: boolean
  /** Per-agent allowance: every agent in the team gets this much. Null = access only. */
  tokenLimit?: number | null
  createdAt: string
  updatedAt: string
  /** One row per agent in the team with its own limit and spend. */
  agents?: {
    id: string
    agentName: string
    tokenLimit: number | null
    usedTokens: number
    inputTokens: number
    outputTokens: number
    tokensLeft: number | null
  }[]
  team: {
    id: string
    name: string
    description: string
    isActive: boolean
    agents: string[]
  }
}

interface TeamAssignmentsResponse {
  data?: AssignedTeam[]
}

interface AgentsByEmailResponse {
  email: string
  agents: string[]
  group?: { id: string; name: string; description: string | null }
}

export type AssignedAgentsResult = {
  agentKeys: string[]
  teams: AssignedTeam[]
};

/**
 * Every agent the user may open. Access comes from two independent sources --
 * the teams assigned to them and the agents assigned one by one in the admin
 * panel -- so both are merged here, and every caller reads the same answer.
 */
export async function fetchAssignedAgents(
  email: string,
  signal?: AbortSignal,
): Promise<AssignedAgentsResult> {
  const agentKeys = new Set<string>();
  let teams: AssignedTeam[] = [];

  // Paginated: { data, total, page, limit, totalPages }.
  const teamsRes = await authenticatedFetch(
    `${API_BASE}/admin/team-assignments?email=${encodeURIComponent(email)}&activeOnly=true&limit=200`,
    { cache: "no-store", signal },
  );
  if (teamsRes.ok) {
    const payload = (await teamsRes.json()) as TeamAssignmentsResponse | AssignedTeam[];
    teams = Array.isArray(payload) ? payload : payload.data ?? [];
    teams.forEach((assignment) => {
      assignment.team?.agents?.forEach((agent) => agentKeys.add(agent));
    });
  }

  // This endpoint responds with { email, agents: string[] }, not an array.
  const agentsRes = await authenticatedFetch(
    `${API_BASE}/admin/agents-by-email?email=${encodeURIComponent(email)}&activeOnly=true`,
    { cache: "no-store", signal },
  );
  if (agentsRes.ok) {
    const agentsData = (await agentsRes.json()) as AgentsByEmailResponse;
    if (Array.isArray(agentsData?.agents)) {
      agentsData.agents.forEach((agent) => agentKeys.add(agent));
    }
  }

  return { agentKeys: Array.from(agentKeys), teams };
}
