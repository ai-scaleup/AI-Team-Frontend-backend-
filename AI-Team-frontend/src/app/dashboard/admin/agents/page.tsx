"use client";

import { API_BASE } from "@/lib/apiBase"
import { authenticatedFetch } from "@/lib/authenticatedFetch";

import { FormEvent, useEffect, useState } from "react";
import {
  Bot, Users, Plus, ShieldCheck, MoreVertical, Search, CreditCard,
  AlertTriangle, Trash2, MessageSquare, Save,
  X, Loader2, Pencil, Coins
} from "lucide-react";


const SINGLE_AGENTS = [
  "SARA_AI", "JENNIFER_AI", "CHIARA_AI", "JIM", "ALEX", "MIKE", "TONY", 
  "LARA", "VALENTINA", "DANIELE", "SIMONE", "NIKO", "ALADINO", "LAURA", "DAN"
];

interface AlertThreshold {
  id: string;
  percentage: number;
  level: "info" | "warning" | "critical";
  message: string;
}

interface AgentTeam {
  id: string;
  name: string;
  description?: string | null;
  agents: string[];
  users?: number;
  /** Default allowance seeded onto each user assignment; null = access only. */
  tokenLimit?: number | null;
}

/** Shape returned by every /admin/teams endpoint. */
interface AgentTeamResponse {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  tokenLimit?: number | null;
  agents?: string[];
  agentCount?: number;
  assignmentCount?: number;
}

interface AgentTeamListResponse {
  data?: AgentTeamResponse[];
}

interface MembershipTemplate {
  id: string;
  name: string;
  durationDays: number;
  monthlyTokenLimit: number;
  /** Single agents bundled directly into the membership. */
  includedAgents?: string[];
  /** Agent teams (from /admin/teams) bundled into the membership. */
  includedTeams?: { id: string; name: string; agents: string[]; isActive: boolean }[];
  includedTeamIds?: string[];
  effectiveAgents?: string[];
}

const DEFAULT_ALERTS: AlertThreshold[] = [
  { id: "a1", percentage: 50, level: "info", message: "You've used 50% of your conversation tokens. Consider wrapping up soon." },
  { id: "a2", percentage: 75, level: "warning", message: "⚠️ 75% of conversation tokens used. You're approaching the limit." },
  { id: "a3", percentage: 90, level: "critical", message: "🚨 90% reached! Your conversation will end soon. Save important info now." },
];

const ALERT_LEVEL_STYLES: Record<string, { badge: string; border: string }> = {
  info: { badge: "bg-sky-500/20 text-sky-400", border: "border-sky-500/20" },
  warning: { badge: "bg-amber-500/20 text-amber-400", border: "border-amber-500/20" },
  critical: { badge: "bg-red-500/20 text-red-400", border: "border-red-500/20" },
};

/**
 * Turns the token-limit text field into the API value: blank -> null (access
 * only), a non-negative integer -> that number, anything else -> undefined so
 * the caller can show a validation error.
 */
const parseTokenLimitInput = (raw: string): number | null | undefined => {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
};

const formatTokenLimit = (limit: number | null | undefined) =>
  typeof limit === "number" ? `${limit.toLocaleString()} tokens / agent` : "Access only";

export default function AgentsAndTeamsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [teams, setTeams] = useState<AgentTeam[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  // Kept as a string so the field can be blank (= no allowance, access only).
  const [teamTokenLimit, setTeamTokenLimit] = useState("");
  const [selectedTeamAgents, setSelectedTeamAgents] = useState<string[]>([]);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamDescription, setEditTeamDescription] = useState("");
  const [editTeamTokenLimit, setEditTeamTokenLimit] = useState("");
  const [editTeamAgents, setEditTeamAgents] = useState<string[]>([]);
  const [isUpdatingTeam, setIsUpdatingTeam] = useState(false);
  const [teamMessage, setTeamMessage] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<MembershipTemplate[]>([]);
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(true);
  const [isMembershipCreateOpen, setIsMembershipCreateOpen] = useState(false);
  const [membershipName, setMembershipName] = useState("");
  const [membershipDurationDays, setMembershipDurationDays] = useState(30);
  const [membershipTokenLimit, setMembershipTokenLimit] = useState(100000);
  const [membershipAgents, setMembershipAgents] = useState<string[]>([]);
  const [membershipTeamIds, setMembershipTeamIds] = useState<string[]>([]);
  const [isCreatingMembership, setIsCreatingMembership] = useState(false);
  const [deletingMembershipId, setDeletingMembershipId] = useState<string | null>(null);
  const [membershipMessage, setMembershipMessage] = useState<string | null>(null);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [editingMembershipId, setEditingMembershipId] = useState<string | null>(null);
  const [editMembershipName, setEditMembershipName] = useState("");
  const [editMembershipDurationDays, setEditMembershipDurationDays] = useState(30);
  const [editMembershipTokenLimit, setEditMembershipTokenLimit] = useState(100000);
  const [editMembershipAgents, setEditMembershipAgents] = useState<string[]>([]);
  const [editMembershipTeamIds, setEditMembershipTeamIds] = useState<string[]>([]);
  const [isUpdatingMembership, setIsUpdatingMembership] = useState(false);

  // Alert Thresholds state
  const [alerts, setAlerts] = useState<AlertThreshold[]>([...DEFAULT_ALERTS]);

  const filteredAgents = SINGLE_AGENTS.filter(a => a.toLowerCase().includes(searchTerm.toLowerCase()));

  const parseApiError = async (response: Response) => {
    try {
      const payload = await response.json();
      if (typeof payload?.message === "string") return payload.message;
      if (Array.isArray(payload?.message)) return payload.message.join(", ");
    } catch {
      // Fall back to text below.
    }

    const text = await response.text().catch(() => "");
    return text || response.statusText || "Request failed.";
  };

  const loadMemberships = async () => {
    setIsLoadingMemberships(true);
    setMembershipError(null);

    try {
      const response = await authenticatedFetch(`${API_BASE}/admin/memberships`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      setMemberships((await response.json()) as MembershipTemplate[]);
    } catch (error) {
      setMembershipError(error instanceof Error ? error.message : "Unable to load memberships.");
      setMemberships([]);
    } finally {
      setIsLoadingMemberships(false);
    }
  };

  const loadTeams = async () => {
    setIsLoadingTeams(true);
    setTeamError(null);

    try {
      // /admin/teams returns each team's agent list inline, so one request is enough.
      const response = await authenticatedFetch(`${API_BASE}/admin/teams?limit=100&sortBy=createdAt&sortOrder=desc`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const payload = (await response.json()) as AgentTeamListResponse | AgentTeamResponse[];
      const loaded = Array.isArray(payload) ? payload : payload.data ?? [];

      setTeams(
        loaded.map((team) => ({
          id: team.id,
          name: team.name,
          description: team.description,
          agents: team.agents ?? [],
          users: team.assignmentCount,
          tokenLimit: team.tokenLimit ?? null,
        })),
      );
    } catch (error) {
      setTeamError(error instanceof Error ? error.message : "Unable to load teams.");
      setTeams([]);
    } finally {
      setIsLoadingTeams(false);
    }
  };

  useEffect(() => {
    void loadMemberships();
    void loadTeams();
  }, []);

  const toggleTeamAgent = (agent: string) => {
    setSelectedTeamAgents(prev =>
      prev.includes(agent) ? prev.filter(item => item !== agent) : [...prev, agent],
    );
  };

  const toggleEditTeamAgent = (agent: string) => {
    setEditTeamAgents(prev =>
      prev.includes(agent) ? prev.filter(item => item !== agent) : [...prev, agent],
    );
  };

  const toggleMembershipAgent = (agent: string) => {
    setMembershipAgents(prev =>
      prev.includes(agent) ? prev.filter(item => item !== agent) : [...prev, agent],
    );
  };

  const toggleEditMembershipAgent = (agent: string) => {
    setEditMembershipAgents(prev =>
      prev.includes(agent) ? prev.filter(item => item !== agent) : [...prev, agent],
    );
  };

  const toggleMembershipTeamId = (teamId: string) => {
    setMembershipTeamIds(prev =>
      prev.includes(teamId) ? prev.filter(item => item !== teamId) : [...prev, teamId],
    );
  };

  const toggleEditMembershipTeamId = (teamId: string) => {
    setEditMembershipTeamIds(prev =>
      prev.includes(teamId) ? prev.filter(item => item !== teamId) : [...prev, teamId],
    );
  };


  const resetCreateTeamForm = () => {
    setTeamName("");
    setTeamDescription("");
    setTeamTokenLimit("");
    setSelectedTeamAgents([]);
  };

  const resetCreateMembershipForm = () => {
    setMembershipName("");
    setMembershipDurationDays(30);
    setMembershipTokenLimit(100000);
    setMembershipAgents([]);
    setMembershipTeamIds([]);
  };


  const startEditingTeam = (team: AgentTeam) => {
    setTeamError(null);
    setTeamMessage(null);
    setEditingTeamId(team.id);
    setEditTeamName(team.name);
    setEditTeamDescription(team.description ?? "");
    setEditTeamTokenLimit(typeof team.tokenLimit === "number" ? String(team.tokenLimit) : "");
    setEditTeamAgents(team.agents);
  };

  const cancelEditingTeam = () => {
    setEditingTeamId(null);
    setEditTeamName("");
    setEditTeamDescription("");
    setEditTeamTokenLimit("");
    setEditTeamAgents([]);
  };

  const createTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTeamError(null);
    setTeamMessage(null);

    if (!teamName.trim()) {
      setTeamError("Team name is required.");
      return;
    }

    if (selectedTeamAgents.length === 0) {
      setTeamError("Select at least one agent for the team.");
      return;
    }

    const tokenLimit = parseTokenLimitInput(teamTokenLimit);
    if (tokenLimit === undefined) {
      setTeamError("Token limit must be a non-negative integer (leave blank for access only).");
      return;
    }

    setIsCreatingTeam(true);

    try {
      const response = await authenticatedFetch(`${API_BASE}/admin/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: teamName.trim(),
          // The API requires a non-empty description; fall back to the name.
          description: teamDescription.trim() || teamName.trim(),
          isActive: true,
          agents: selectedTeamAgents,
          tokenLimit,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const created = (await response.json()) as AgentTeamResponse;

      setTeams(prev => [
        {
          id: created.id,
          name: created.name,
          description: created.description,
          agents: created.agents ?? selectedTeamAgents,
          users: created.assignmentCount ?? 0,
          tokenLimit: created.tokenLimit ?? tokenLimit,
        },
        ...prev,
      ]);
      setTeamMessage(`Created "${teamName.trim()}".`);
      resetCreateTeamForm();
      setIsCreateOpen(false);
    } catch (error) {
      setTeamError(error instanceof Error ? error.message : "Unable to create team.");
    } finally {
      setIsCreatingTeam(false);
    }
  };

  const createMembership = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMembershipError(null);
    setMembershipMessage(null);

    if (!membershipName.trim()) {
      setMembershipError("Membership name is required.");
      return;
    }

    if (!Number.isInteger(membershipDurationDays) || membershipDurationDays < 1) {
      setMembershipError("Duration must be at least 1 day.");
      return;
    }

    if (!Number.isInteger(membershipTokenLimit) || membershipTokenLimit < 0) {
      setMembershipError("Monthly token limit must be a non-negative integer.");
      return;
    }

    if (membershipAgents.length === 0 && membershipTeamIds.length === 0) {
      setMembershipError("Select at least one single agent or team.");
      return;
    }

    setIsCreatingMembership(true);

    try {
      // Single agents and teams travel as two separate lists.
      const response = await authenticatedFetch(`${API_BASE}/admin/memberships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: membershipName.trim(),
          durationDays: membershipDurationDays,
          monthlyTokenLimit: membershipTokenLimit,
          includedAgents: membershipAgents,
          includedTeamIds: membershipTeamIds,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const created = (await response.json()) as MembershipTemplate;
      setMemberships(prev => [created, ...prev]);
      setMembershipMessage(`Created "${created.name}".`);
      resetCreateMembershipForm();
      setIsMembershipCreateOpen(false);
    } catch (error) {
      setMembershipError(error instanceof Error ? error.message : "Unable to create membership.");
    } finally {
      setIsCreatingMembership(false);
    }
  };

  const startEditingMembership = (membership: MembershipTemplate) => {
    setMembershipError(null);
    setMembershipMessage(null);
    setEditingMembershipId(membership.id);
    setEditMembershipName(membership.name);
    setEditMembershipDurationDays(membership.durationDays);
    setEditMembershipTokenLimit(membership.monthlyTokenLimit);
    setEditMembershipAgents(membership.includedAgents ?? []);
    setEditMembershipTeamIds(
      membership.includedTeamIds ?? membership.includedTeams?.map(team => team.id) ?? [],
    );
  };

  const cancelEditingMembership = () => {
    setEditingMembershipId(null);
    setEditMembershipAgents([]);
    setEditMembershipTeamIds([]);
  };

  const updateMembership = async (membership: MembershipTemplate) => {
    setMembershipError(null);
    setMembershipMessage(null);

    if (!editMembershipName.trim()) {
      setMembershipError("Membership name is required.");
      return;
    }

    if (!Number.isInteger(editMembershipDurationDays) || editMembershipDurationDays < 1) {
      setMembershipError("Duration must be at least 1 day.");
      return;
    }

    if (!Number.isInteger(editMembershipTokenLimit) || editMembershipTokenLimit < 0) {
      setMembershipError("Monthly token limit must be a non-negative integer.");
      return;
    }

    if (editMembershipAgents.length === 0 && editMembershipTeamIds.length === 0) {
      setMembershipError("Select at least one single agent or team.");
      return;
    }

    setIsUpdatingMembership(true);

    try {
      const response = await authenticatedFetch(`${API_BASE}/admin/memberships/${membership.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editMembershipName.trim(),
          durationDays: editMembershipDurationDays,
          monthlyTokenLimit: editMembershipTokenLimit,
          includedAgents: editMembershipAgents,
          includedTeamIds: editMembershipTeamIds,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const updated = (await response.json()) as MembershipTemplate;
      setMemberships(prev => prev.map(item => (item.id === updated.id ? updated : item)));
      setMembershipMessage(`Updated "${updated.name}".`);
      cancelEditingMembership();
    } catch (error) {
      setMembershipError(error instanceof Error ? error.message : "Unable to update membership.");
    } finally {
      setIsUpdatingMembership(false);
    }
  };

  const deleteMembership = async (membership: MembershipTemplate) => {
    setMembershipError(null);
    setMembershipMessage(null);

    const confirmed = window.confirm(`Delete "${membership.name}"? Users holding this membership will lose it.`);
    if (!confirmed) return;

    setDeletingMembershipId(membership.id);

    try {
      const response = await authenticatedFetch(`${API_BASE}/admin/memberships/${membership.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      setMemberships(prev => prev.filter(item => item.id !== membership.id));
      setMembershipMessage(`Deleted "${membership.name}".`);
    } catch (error) {
      setMembershipError(error instanceof Error ? error.message : "Unable to delete membership.");
    } finally {
      setDeletingMembershipId(null);
    }
  };

  const deleteTeam = async (team: AgentTeam) => {
    setTeamError(null);
    setTeamMessage(null);

    const confirmed = window.confirm(`Delete "${team.name}"? This will remove the team and its user assignments.`);
    if (!confirmed) return;

    setDeletingTeamId(team.id);

    try {
      const response = await authenticatedFetch(`${API_BASE}/admin/teams/${team.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      setTeams(prev => prev.filter(item => item.id !== team.id));
      // The team link cascades server-side; drop it from membership cards and pickers too.
      setMembershipTeamIds(prev => prev.filter(id => id !== team.id));
      setEditMembershipTeamIds(prev => prev.filter(id => id !== team.id));
      setMemberships(prev =>
        prev.map(membership => ({
          ...membership,
          includedTeams: membership.includedTeams?.filter(item => item.id !== team.id),
          includedTeamIds: membership.includedTeamIds?.filter(id => id !== team.id),
        })),
      );
      setTeamMessage(`Deleted "${team.name}".`);
    } catch (error) {
      setTeamError(error instanceof Error ? error.message : "Unable to delete team.");
    } finally {
      setDeletingTeamId(null);
    }
  };

  const updateTeam = async (team: AgentTeam) => {
    setTeamError(null);
    setTeamMessage(null);

    if (!editTeamName.trim()) {
      setTeamError("Team name is required.");
      return;
    }

    if (editTeamAgents.length === 0) {
      setTeamError("Select at least one agent for the team.");
      return;
    }

    const tokenLimit = parseTokenLimitInput(editTeamTokenLimit);
    if (tokenLimit === undefined) {
      setTeamError("Token limit must be a non-negative integer (leave blank for access only).");
      return;
    }

    setIsUpdatingTeam(true);

    try {
      // One PATCH covers name, description, token limit and the full agent list.
      const response = await authenticatedFetch(`${API_BASE}/admin/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editTeamName.trim(),
          description: editTeamDescription.trim() || editTeamName.trim(),
          isActive: true,
          agents: editTeamAgents,
          // null clears the allowance on the API side.
          tokenLimit,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const updated = (await response.json()) as AgentTeamResponse;

      setTeams(prev =>
        prev.map(item =>
          item.id === team.id
            ? {
                ...item,
                name: updated.name,
                description: updated.description,
                agents: updated.agents ?? editTeamAgents,
                users: updated.assignmentCount ?? item.users,
                tokenLimit: updated.tokenLimit ?? tokenLimit,
              }
            : item,
        ),
      );
      // Keep the team chips on membership cards current without a refetch.
      setMemberships(prev =>
        prev.map(membership => ({
          ...membership,
          includedTeams: membership.includedTeams?.map(item =>
            item.id === team.id
              ? {
                  ...item,
                  name: updated.name,
                  agents: updated.agents ?? editTeamAgents,
                  isActive: updated.isActive ?? item.isActive,
                }
              : item,
          ),
        })),
      );
      setTeamMessage(`Updated "${editTeamName.trim()}".`);
      cancelEditingTeam();
    } catch (error) {
      setTeamError(error instanceof Error ? error.message : "Unable to update team.");
    } finally {
      setIsUpdatingTeam(false);
    }
  };

  const addAlert = () => {
    const newId = `a${Date.now()}`;
    setAlerts(prev => [...prev, {
      id: newId,
      percentage: 80,
      level: "warning",
      message: "You're approaching the conversation token limit.",
    }]);
  };

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const updateAlert = (id: string, field: keyof AlertThreshold, value: string | number) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents, Teams & Memberships</h1>
          <p className="text-sm text-white/50">Manage your AI workforce and subscription packages</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Col: Teams */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Teams Section */}
          <section className="flex max-h-[calc(100vh-9rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0F172A] p-6">
            <div className="mb-6 flex shrink-0 items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Users size={20} className="text-indigo-400" /> Agent Teams
              </h2>
              <button
                onClick={() => {
                  setIsCreateOpen(prev => !prev);
                  setTeamError(null);
                  setTeamMessage(null);
                }}
                className="flex items-center gap-2 rounded-xl bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-400 transition hover:bg-indigo-500/20"
              >
                {isCreateOpen ? <X size={16} /> : <Plus size={16} />}
                {isCreateOpen ? "Close" : "Create Team"}
              </button>
            </div>

            {isCreateOpen && (
              <form
                onSubmit={createTeam}
                className="mb-6 shrink-0 rounded-xl border border-indigo-400/20 bg-indigo-500/[0.04] p-4"
              >
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs text-white/50">Team name</label>
                    <input
                      value={teamName}
                      onChange={(event) => setTeamName(event.target.value)}
                      placeholder="Marketing Powerhouse"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-indigo-400/60"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-white/50">Description</label>
                    <input
                      value={teamDescription}
                      onChange={(event) => setTeamDescription(event.target.value)}
                      placeholder="Optional team description"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-indigo-400/60"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-white/50">Token limit (per agent)</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={teamTokenLimit}
                      onChange={(event) => setTeamTokenLimit(event.target.value)}
                      placeholder="Leave blank for access only"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-indigo-400/60"
                    />
                    <p className="mt-1 text-[11px] text-white/35">
                      Applied per agent: every agent in the team gets this many tokens for each user the team is assigned to.
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-xs text-white/50">Agents</label>
                  <div className="flex flex-wrap gap-2">
                    {SINGLE_AGENTS.map(agent => {
                      const isSelected = selectedTeamAgents.includes(agent);
                      return (
                        <button
                          key={agent}
                          type="button"
                          onClick={() => toggleTeamAgent(agent)}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                            isSelected
                              ? "border-indigo-400/60 bg-indigo-500/20 text-indigo-200"
                              : "border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:text-white/80"
                          }`}
                        >
                          {agent}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={isCreatingTeam}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCreatingTeam ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                    Create Team
                  </button>
                </div>
              </form>
            )}

            {(teamError || teamMessage) && (
              <div
                className={`mb-4 shrink-0 rounded-xl border px-4 py-3 text-sm ${
                  teamError
                    ? "border-red-400/20 bg-red-500/10 text-red-200"
                    : "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                }`}
              >
                {teamError ?? teamMessage}
              </div>
            )}
            
            <div className="grid min-h-0 grid-cols-1 gap-4 overflow-y-auto pr-2 md:grid-cols-2 custom-scrollbar">
              {isLoadingTeams && (
                <div className="md:col-span-2 flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/5 p-8 text-sm text-white/45">
                  <Loader2 size={16} className="animate-spin" />
                  Loading teams...
                </div>
              )}

              {!isLoadingTeams && teams.length === 0 && (
                <div className="md:col-span-2 rounded-xl border border-white/5 bg-white/5 p-8 text-center text-sm text-white/35">
                  No agent teams found.
                </div>
              )}

              {!isLoadingTeams && teams.map(team => (
                <div key={team.id} className="rounded-xl border border-white/5 bg-white/5 p-4 hover:bg-white/10 transition">
                  {editingTeamId === team.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="mb-1.5 block text-xs text-white/45">Team name</label>
                          <input
                            value={editTeamName}
                            onChange={(event) => setEditTeamName(event.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-400/60"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs text-white/45">Description</label>
                          <input
                            value={editTeamDescription}
                            onChange={(event) => setEditTeamDescription(event.target.value)}
                            placeholder="Optional team description"
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-indigo-400/60"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs text-white/45">Token limit (per agent)</label>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={editTeamTokenLimit}
                            onChange={(event) => setEditTeamTokenLimit(event.target.value)}
                            placeholder="Leave blank for access only"
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-indigo-400/60"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs text-white/45">Agents</label>
                        <div className="flex flex-wrap gap-2">
                          {SINGLE_AGENTS.map(agent => {
                            const isSelected = editTeamAgents.includes(agent);
                            return (
                              <button
                                key={agent}
                                type="button"
                                onClick={() => toggleEditTeamAgent(agent)}
                                className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                                  isSelected
                                    ? "border-indigo-400/60 bg-indigo-500/20 text-indigo-200"
                                    : "border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:text-white/80"
                                }`}
                              >
                                {agent}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={cancelEditingTeam}
                          disabled={isUpdatingTeam}
                          className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white/60 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTeam(team)}
                          disabled={isUpdatingTeam}
                          className="flex items-center gap-2 rounded-lg bg-indigo-600/90 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isUpdatingTeam ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-white/90">{team.name}</h3>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEditingTeam(team)}
                            title="Edit team"
                            className="rounded-lg p-1.5 text-white/35 transition hover:bg-indigo-500/10 hover:text-indigo-300"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => deleteTeam(team)}
                            disabled={deletingTeamId === team.id}
                            title="Delete team"
                            className="rounded-lg p-1.5 text-white/35 transition hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingTeamId === team.id ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {team.agents.map(agent => (
                          <span key={agent} className="rounded-md bg-white/10 px-2 py-1 text-xs text-white/70">
                            {agent}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/40">
                        <span className="flex items-center gap-2">
                          <Users size={14} />
                          {typeof team.users === "number" ? `${team.users} active user` : "Assigned users managed by email"}
                        </span>
                        <span className="flex items-center gap-2" title="Token allowance each agent gets per assigned user">
                          <Coins size={14} />
                          {formatTokenLimit(team.tokenLimit)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Memberships Section */}
          <section className="rounded-2xl border border-white/10 bg-[#0F172A] p-6">
             <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CreditCard size={20} className="text-emerald-400" /> Predefined Memberships
              </h2>
              <button
                onClick={() => {
                  setIsMembershipCreateOpen(prev => !prev);
                  setMembershipError(null);
                  setMembershipMessage(null);
                }}
                className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/20"
              >
                {isMembershipCreateOpen ? <X size={16} /> : <Plus size={16} />}
                {isMembershipCreateOpen ? "Close" : "Create Membership"}
              </button>
            </div>

            {isMembershipCreateOpen && (
              <form
                onSubmit={createMembership}
                className="mb-6 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.04] p-4"
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-xs text-white/50">Membership name</label>
                    <input
                      value={membershipName}
                      onChange={(event) => setMembershipName(event.target.value)}
                      placeholder="1 year Sara AI"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-emerald-400/60"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-white/50">Duration days</label>
                    <input
                      type="number"
                      min={1}
                      value={membershipDurationDays}
                      onChange={(event) => setMembershipDurationDays(Number(event.target.value))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-400/60"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-white/50">Tokens per month (shared)</label>
                    <input
                      type="number"
                      min={0}
                      value={membershipTokenLimit}
                      onChange={(event) => setMembershipTokenLimit(Number(event.target.value))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-400/60"
                    />
                    <p className="mt-1 text-[11px] text-white/35">One pool for every agent in the membership, not per agent.</p>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-xs text-white/50">Single agents</label>
                  <div className="flex flex-wrap gap-2">
                    {SINGLE_AGENTS.map(agent => {
                      const isSelected = membershipAgents.includes(agent);
                      return (
                        <button
                          key={agent}
                          type="button"
                          onClick={() => toggleMembershipAgent(agent)}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                            isSelected
                              ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
                              : "border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:text-white/80"
                          }`}
                        >
                          {agent}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-xs text-white/50">Teams</label>
                  {isLoadingTeams ? (
                    <p className="text-xs text-white/35">Loading teams...</p>
                  ) : teams.length === 0 ? (
                    <p className="text-xs text-white/35">
                      No agent teams yet. Create one in the Agent Teams section above.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {teams.map(team => {
                        const isSelected = membershipTeamIds.includes(team.id);
                        return (
                          <button
                            key={team.id}
                            type="button"
                            onClick={() => toggleMembershipTeamId(team.id)}
                            title={team.agents.join(", ")}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                              isSelected
                                ? "border-violet-400/60 bg-violet-500/20 text-violet-200"
                                : "border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:text-white/80"
                            }`}
                          >
                            <Users size={11} className="mr-1 inline-block" />
                            {team.name}
                            <span className="ml-1 text-white/35">({team.agents.length})</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={isCreatingMembership}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCreatingMembership ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                    Create Membership
                  </button>
                </div>
              </form>
            )}

            {(membershipError || membershipMessage) && (
              <div
                className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                  membershipError
                    ? "border-red-400/20 bg-red-500/10 text-red-200"
                    : "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                }`}
              >
                {membershipError ?? membershipMessage}
              </div>
            )}

            <div className="space-y-3">
              {isLoadingMemberships && (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/5 p-6 text-sm text-white/45">
                  <Loader2 size={16} className="animate-spin" />
                  Loading memberships...
                </div>
              )}

              {!isLoadingMemberships && memberships.length === 0 && (
                <div className="rounded-xl border border-white/5 bg-white/5 p-6 text-center text-sm text-white/35">
                  No memberships found.
                </div>
              )}

              {!isLoadingMemberships && memberships.map(membership => {
                const chips = membership.includedAgents ?? [];

                if (editingMembershipId === membership.id) {
                  return (
                    <div
                      key={membership.id}
                      className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.04] p-4"
                    >
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div>
                          <label className="mb-1.5 block text-xs text-white/50">Membership name</label>
                          <input
                            value={editMembershipName}
                            onChange={(event) => setEditMembershipName(event.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-400/60"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs text-white/50">Duration days</label>
                          <input
                            type="number"
                            min={1}
                            value={editMembershipDurationDays}
                            onChange={(event) => setEditMembershipDurationDays(Number(event.target.value))}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-400/60"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs text-white/50">Tokens per month (shared)</label>
                          <input
                            type="number"
                            min={0}
                            value={editMembershipTokenLimit}
                            onChange={(event) => setEditMembershipTokenLimit(Number(event.target.value))}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-400/60"
                          />
                          <p className="mt-1 text-[11px] text-white/35">One pool for every agent in the membership, not per agent.</p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="mb-2 block text-xs text-white/50">Single agents</label>
                        <div className="flex flex-wrap gap-2">
                          {SINGLE_AGENTS.map(agent => {
                            const isSelected = editMembershipAgents.includes(agent);
                            return (
                              <button
                                key={agent}
                                type="button"
                                onClick={() => toggleEditMembershipAgent(agent)}
                                className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                                  isSelected
                                    ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
                                    : "border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:text-white/80"
                                }`}
                              >
                                {agent}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="mb-2 block text-xs text-white/50">Teams</label>
                        {teams.length === 0 ? (
                          <p className="text-xs text-white/35">No agent teams yet.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {teams.map(team => {
                              const isSelected = editMembershipTeamIds.includes(team.id);
                              return (
                                <button
                                  key={team.id}
                                  type="button"
                                  onClick={() => toggleEditMembershipTeamId(team.id)}
                                  title={team.agents.join(", ")}
                                  className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                                    isSelected
                                      ? "border-violet-400/60 bg-violet-500/20 text-violet-200"
                                      : "border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:text-white/80"
                                  }`}
                                >
                                  <Users size={11} className="mr-1 inline-block" />
                                  {team.name}
                                  <span className="ml-1 text-white/35">({team.agents.length})</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={cancelEditingMembership}
                          disabled={isUpdatingMembership}
                          className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white/60 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => updateMembership(membership)}
                          disabled={isUpdatingMembership}
                          className="flex items-center gap-2 rounded-lg bg-emerald-600/90 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isUpdatingMembership ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          Save
                        </button>
                      </div>
                    </div>
                  );
                }

                const teamChips = membership.includedTeams ?? [];

                return (
                  <div key={membership.id} className="flex items-start justify-between gap-4 rounded-xl border border-white/5 bg-white/5 p-4">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white/90">{membership.name}</h3>
                      <div className="mt-1 flex items-center gap-3 text-xs text-white/50">
                        <span>{membership.durationDays} Days</span>
                        <span>-</span>
                        <span title="Shared by every agent in the membership">{(membership.monthlyTokenLimit / 1000).toFixed(0)}k Tokens/mo shared</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="mr-1 text-[10px] uppercase tracking-wide text-white/35">Agents</span>
                          {chips.length === 0 && <span className="text-[10px] text-white/25">none</span>}
                          {chips.map(item => (
                            <span key={item} className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] text-sky-300">
                              {item}
                            </span>
                          ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="mr-1 text-[10px] uppercase tracking-wide text-white/35">Teams</span>
                          {teamChips.length === 0 && <span className="text-[10px] text-white/25">none</span>}
                          {teamChips.map(team => (
                            <span
                              key={team.id}
                              title={team.agents.join(", ")}
                              className={`rounded px-2 py-0.5 text-[10px] ${
                                team.isActive
                                  ? "bg-violet-500/20 text-violet-300"
                                  : "bg-white/10 text-white/40 line-through"
                              }`}
                            >
                              <Users size={10} className="mr-1 inline-block" />
                              {team.name} ({team.agents.length})
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => startEditingMembership(membership)}
                        title="Edit membership"
                        className="rounded-lg p-1.5 text-white/35 transition hover:bg-emerald-500/10 hover:text-emerald-300"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => deleteMembership(membership)}
                        disabled={deletingMembershipId === membership.id}
                        title="Delete membership"
                        className="rounded-lg p-1.5 text-white/35 transition hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingMembershipId === membership.id ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ──────── TOKEN ALERT THRESHOLDS ──────── */}
          <section className="rounded-2xl border border-white/10 bg-[#0F172A] p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle size={20} className="text-rose-400" /> Token Usage Alerts
              </h2>
              <button
                onClick={addAlert}
                className="flex items-center gap-2 rounded-xl bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-400 transition hover:bg-rose-500/20"
              >
                <Plus size={16} /> Add Threshold
              </button>
            </div>
            <p className="text-xs text-white/40 mb-6">
              Configure alerts that appear in the user&apos;s announcer bar as the conversation approaches its token limit.
            </p>

            <div className="space-y-3">
              {alerts.length === 0 && (
                <div className="text-center py-8 text-white/20 text-sm">
                  No alert thresholds configured. Click &quot;Add Threshold&quot; to create one.
                </div>
              )}
              {alerts
                .sort((a, b) => a.percentage - b.percentage)
                .map((alert) => {
                  const styles = ALERT_LEVEL_STYLES[alert.level];
                  return (
                    <div
                      key={alert.id}
                      className={`rounded-xl border ${styles.border} bg-white/[0.02] p-4 transition hover:bg-white/[0.04]`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Threshold % */}
                        <div className="flex-shrink-0">
                          <label className="text-[10px] uppercase tracking-wider text-white/30 block mb-1">Threshold</label>
                          <div className="relative">
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={alert.percentage}
                              onChange={(e) => updateAlert(alert.id, "percentage", Number(e.target.value))}
                              className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-500 transition text-center"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-white/30">%</span>
                          </div>
                        </div>

                        {/* Alert Level */}
                        <div className="flex-shrink-0">
                          <label className="text-[10px] uppercase tracking-wider text-white/30 block mb-1">Level</label>
                          <select
                            value={alert.level}
                            onChange={(e) => updateAlert(alert.id, "level", e.target.value)}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-500 transition appearance-none pr-7"
                          >
                            <option value="info">ℹ️ Info</option>
                            <option value="warning">⚠️ Warning</option>
                            <option value="critical">🚨 Critical</option>
                          </select>
                        </div>

                        {/* Notification Message */}
                        <div className="flex-1">
                          <label className="text-[10px] uppercase tracking-wider text-white/30 block mb-1">
                            <MessageSquare size={10} className="inline mr-1" />
                            Announcer Message
                          </label>
                          <input
                            type="text"
                            value={alert.message}
                            onChange={(e) => updateAlert(alert.id, "message", e.target.value)}
                            placeholder="Message shown to the user..."
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-sky-500 transition"
                          />
                        </div>

                        {/* Delete */}
                        <div className="flex-shrink-0 pt-5">
                          <button
                            onClick={() => removeAlert(alert.id)}
                            className="rounded-lg p-2 text-white/20 hover:text-red-400 hover:bg-red-500/10 transition"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Preview */}
                      <div className="mt-3 ml-0 flex items-center gap-2">
                        <span className="text-[10px] text-white/20">Preview:</span>
                        <div className={`rounded-lg px-3 py-1.5 text-xs ${styles.badge} flex items-center gap-1.5`}>
                          <AlertTriangle size={11} />
                          <span className="truncate max-w-[500px]">{alert.message || "No message set"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
              <p className="text-[11px] text-white/25 flex items-center gap-1.5">
                <MessageSquare size={12} />
                These alerts appear in the user&apos;s announcer bar during active conversations.
              </p>
              <button className="flex items-center gap-2 rounded-xl bg-rose-600/90 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 shadow-lg shadow-rose-500/15">
                <Save size={14} /> Save Alerts
              </button>
            </div>
          </section>

        </div>

        {/* Right Col: Single Agents */}
        <div className="sticky top-8 flex max-h-[calc(100vh-4rem)] flex-col rounded-2xl border border-white/10 bg-[#0F172A] p-6">
           <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Bot size={20} className="text-sky-400" /> Single Agents
          </h2>
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
            <input 
              type="text" 
              placeholder="Search agents..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-sm text-white placeholder-white/40 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
            {filteredAgents.map(agent => (
              <div key={agent} className="flex items-center justify-between rounded-xl bg-white/5 p-3 hover:bg-white/10 transition">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
                    <ShieldCheck size={16} />
                  </div>
                  <span className="font-medium text-sm text-white/80">{agent}</span>
                </div>
                <button className="text-white/30 hover:text-white"><MoreVertical size={14} /></button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
