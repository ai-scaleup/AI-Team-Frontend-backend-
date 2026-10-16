import { API_BASE } from "@/lib/apiBase";
import { authenticatedFetch } from "@/lib/authenticatedFetch";
import type { AgencyMembership } from "./agencyTypes";

// Agency memberships are the one real (server-backed) part of the agencies
// page; everything else on it is still demo data.

type AgencyMembershipResponse = {
  id: string;
  name: string;
  includedAgents: string[];
  includedTeams: { id: string; name: string }[];
  monthlyTokenLimit: number;
  createdAt: string;
};

export type TeamOption = { id: string; name: string; agents: string[] };

export type LlmModelOption = { id: string; label: string; isDefault: boolean };

// Production agents a membership can bundle (AgentName enum, test agents left out).
export const AGENT_OPTIONS = [
  "ALEX", "TONY", "MIKE", "SIMONE", "LARA", "VALENTINA", "NIKO", "JIM", "DANIELE",
  "ALADINO", "LAURA", "DAN", "MAX", "SOFIA", "ROBERTA", "LUCA", "SARA_AI",
  "JENNIFER_AI", "CHIARA_AI", "VANESSA", "FREAP_CHIARA", "FREAP_JENNIFER", "PEARL_ADMIN",
];

async function errorMessage(response: Response) {
  try {
    const payload = await response.json();
    if (typeof payload?.message === "string") return payload.message;
    if (Array.isArray(payload?.message)) return payload.message.join(", ");
  } catch {
    // Fall back to status text.
  }
  return response.statusText || "Request failed";
}

const toMembership = (m: AgencyMembershipResponse): AgencyMembership => ({
  id: m.id,
  name: m.name,
  // Teams first, then single agents: the same labels the seat pools show.
  agents: [...m.includedTeams.map((t) => t.name), ...m.includedAgents],
  teamIds: m.includedTeams.map((t) => t.id),
  singleAgents: m.includedAgents,
  monthlyTokenLimit: m.monthlyTokenLimit,
  createdAt: m.createdAt,
});

export async function fetchAgencyMemberships(): Promise<AgencyMembership[]> {
  const response = await authenticatedFetch(`${API_BASE}/admin/agency-memberships`, { cache: "no-store" });
  if (!response.ok) throw new Error(await errorMessage(response));
  return ((await response.json()) as AgencyMembershipResponse[]).map(toMembership);
}

export type AgencyMembershipInput = {
  name: string;
  includedAgents: string[];
  includedTeamIds: string[];
  monthlyTokenLimit: number;
};

export async function createAgencyMembership(input: AgencyMembershipInput): Promise<AgencyMembership> {
  const response = await authenticatedFetch(`${API_BASE}/admin/agency-memberships`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return toMembership((await response.json()) as AgencyMembershipResponse);
}

export async function updateAgencyMembership(id: string, input: AgencyMembershipInput): Promise<AgencyMembership> {
  const response = await authenticatedFetch(`${API_BASE}/admin/agency-memberships/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return toMembership((await response.json()) as AgencyMembershipResponse);
}

/** Archives on the server; the row is kept, never deleted. */
export async function archiveAgencyMembership(id: string): Promise<void> {
  const response = await authenticatedFetch(`${API_BASE}/admin/agency-memberships/${encodeURIComponent(id)}/archive`, {
    method: "POST",
  });
  if (!response.ok) throw new Error(await errorMessage(response));
}

export async function fetchTeamOptions(): Promise<TeamOption[]> {
  const response = await authenticatedFetch(
    `${API_BASE}/admin/teams?limit=100&isActive=true&sortBy=name&sortOrder=asc`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(await errorMessage(response));
  const payload = (await response.json()) as { data?: TeamOption[] } | TeamOption[];
  return (Array.isArray(payload) ? payload : payload.data ?? []).map((t) => ({ id: t.id, name: t.name, agents: t.agents ?? [] }));
}

/** The chat model catalog (Anthropic only for now), as on the Assign page. */
export async function fetchLlmModels(): Promise<LlmModelOption[]> {
  const response = await authenticatedFetch(`${API_BASE}/admin/llm-models?provider=anthropic`, { cache: "no-store" });
  if (!response.ok) throw new Error(await errorMessage(response));
  return ((await response.json()) as LlmModelOption[]).map((m) => ({ id: m.id, label: m.label, isDefault: m.isDefault }));
}
