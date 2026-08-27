"use client";

import { authenticatedFetch } from "@/lib/authenticatedFetch";

import { FormEvent, useEffect, useState } from "react";
import {
  Bot, Users, Plus, ShieldCheck, MoreVertical, Search, CreditCard,
  AlertTriangle, ToggleLeft, ToggleRight, Trash2, MessageSquare, Save, Zap,
  X, Loader2, Pencil
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

const SINGLE_AGENTS = [
  "SARA_AI", "JENNIFER_AI", "CHIARA_AI", "JIM", "ALEX", "MIKE", "TONY", 
  "LARA", "VALENTINA", "DANIELE", "SIMONE", "NIKO", "ALADINO", "LAURA", "DAN"
];

const MOCK_MEMBERSHIPS: { id: number; name: string; durationDays: number; tokens: number; items: string[] }[] = [];

// Default per-agent limits (mock)
const DEFAULT_PER_AGENT_LIMITS: Record<string, number> = {
  SARA_AI: 16000,
  JENNIFER_AI: 16000,
  CHIARA_AI: 12000,
  JIM: 8000,
  ALEX: 8000,
  MIKE: 8000,
  TONY: 8000,
  LARA: 10000,
  VALENTINA: 10000,
  DANIELE: 10000,
  SIMONE: 12000,
  NIKO: 8000,
  ALADINO: 8000,
  LAURA: 12000,
  DAN: 12000,
};

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
}

interface AgentGroupListItem {
  id: string;
  name: string;
  description?: string | null;
}

interface AgentGroupListResponse {
  data?: AgentGroupListItem[];
}

interface AgentGroupDetails extends AgentGroupListItem {
  agents?: string[];
}

interface MembershipTemplate {
  id: string;
  name: string;
  durationDays: number;
  monthlyTokenLimit: number;
  includedAgents?: string[];
  includedGroupIds?: string[];
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

export default function AgentsAndTeamsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [teams, setTeams] = useState<AgentTeam[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [selectedTeamAgents, setSelectedTeamAgents] = useState<string[]>([]);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamDescription, setEditTeamDescription] = useState("");
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
  const [membershipGroupIds, setMembershipGroupIds] = useState<string[]>([]);
  const [isCreatingMembership, setIsCreatingMembership] = useState(false);
  const [membershipMessage, setMembershipMessage] = useState<string | null>(null);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [editingMembershipId, setEditingMembershipId] = useState<string | null>(null);
  const [editMembershipName, setEditMembershipName] = useState("");
  const [editMembershipDurationDays, setEditMembershipDurationDays] = useState(30);
  const [editMembershipTokenLimit, setEditMembershipTokenLimit] = useState(100000);
  const [editMembershipAgents, setEditMembershipAgents] = useState<string[]>([]);
  const [editMembershipGroupIds, setEditMembershipGroupIds] = useState<string[]>([]);
  const [isUpdatingMembership, setIsUpdatingMembership] = useState(false);

  // Conversation Limits state
  const [globalMode, setGlobalMode] = useState(true);
  const [globalLimit, setGlobalLimit] = useState(16000);
  const [perAgentLimits, setPerAgentLimits] = useState<Record<string, number>>({ ...DEFAULT_PER_AGENT_LIMITS });

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
      const response = await authenticatedFetch(`${API_BASE}/admin/groups?limit=100&sortBy=createdAt&sortOrder=desc`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const payload = (await response.json()) as AgentGroupListResponse | AgentGroupListItem[];
      const groups = Array.isArray(payload) ? payload : payload.data ?? [];

      const details = await Promise.all(
        groups.map(async (group) => {
          const detailResponse = await authenticatedFetch(`${API_BASE}/admin/groups/${group.id}`, {
            cache: "no-store",
          });

          if (!detailResponse.ok) {
            return { ...group, agents: [] };
          }

          return (await detailResponse.json()) as AgentGroupDetails;
        }),
      );

      setTeams(
        details.map((group) => ({
          id: group.id,
          name: group.name,
          description: group.description,
          agents: group.agents ?? [],
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

  const updateAgentLimit = (agent: string, value: number) => {
    setPerAgentLimits(prev => ({ ...prev, [agent]: value }));
  };

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

  const toggleMembershipGroup = (groupId: string) => {
    setMembershipGroupIds(prev =>
      prev.includes(groupId) ? prev.filter(item => item !== groupId) : [...prev, groupId],
    );
  };

  const toggleEditMembershipAgent = (agent: string) => {
    setEditMembershipAgents(prev =>
      prev.includes(agent) ? prev.filter(item => item !== agent) : [...prev, agent],
    );
  };

  const toggleEditMembershipGroup = (groupId: string) => {
    setEditMembershipGroupIds(prev =>
      prev.includes(groupId) ? prev.filter(item => item !== groupId) : [...prev, groupId],
    );
  };

  const resetCreateTeamForm = () => {
    setTeamName("");
    setTeamDescription("");
    setSelectedTeamAgents([]);
  };

  const resetCreateMembershipForm = () => {
    setMembershipName("");
    setMembershipDurationDays(30);
    setMembershipTokenLimit(100000);
    setMembershipAgents([]);
    setMembershipGroupIds([]);
  };

  const startEditingTeam = (team: AgentTeam) => {
    setTeamError(null);
    setTeamMessage(null);
    setEditingTeamId(team.id);
    setEditTeamName(team.name);
    setEditTeamDescription(team.description ?? "");
    setEditTeamAgents(team.agents);
  };

  const cancelEditingTeam = () => {
    setEditingTeamId(null);
    setEditTeamName("");
    setEditTeamDescription("");
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

    setIsCreatingTeam(true);

    try {
      const response = await authenticatedFetch(`${API_BASE}/admin/groups-with-agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: teamName.trim(),
          description: teamDescription.trim() || undefined,
          isActive: true,
          agentNames: selectedTeamAgents,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Unable to create team.");
      }

      const result = await response.json();
      const group = result.group as AgentGroupListItem;

      setTeams(prev => [
        {
          id: group.id,
          name: group.name,
          description: group.description,
          agents: selectedTeamAgents,
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

    if (membershipAgents.length === 0 && membershipGroupIds.length === 0) {
      setMembershipError("Select at least one agent or team.");
      return;
    }

    setIsCreatingMembership(true);

    try {
      const response = await authenticatedFetch(`${API_BASE}/admin/memberships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: membershipName.trim(),
          durationDays: membershipDurationDays,
          monthlyTokenLimit: membershipTokenLimit,
          includedAgents: membershipAgents,
          includedGroupIds: membershipGroupIds,
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
    setEditMembershipGroupIds(membership.includedGroupIds ?? []);
  };

  const cancelEditingMembership = () => {
    setEditingMembershipId(null);
    setEditMembershipAgents([]);
    setEditMembershipGroupIds([]);
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

    if (editMembershipAgents.length === 0 && editMembershipGroupIds.length === 0) {
      setMembershipError("Select at least one agent or team.");
      return;
    }

    setIsUpdatingMembership(true);

    try {
      // includedGroupIds replaces the template's team list. Dropping a team
      // only deactivates its link on the server, so no row is ever removed.
      const response = await authenticatedFetch(`${API_BASE}/admin/memberships/${membership.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editMembershipName.trim(),
          durationDays: editMembershipDurationDays,
          monthlyTokenLimit: editMembershipTokenLimit,
          includedAgents: editMembershipAgents,
          includedGroupIds: editMembershipGroupIds,
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

  const deleteTeam = async (team: AgentTeam) => {
    setTeamError(null);
    setTeamMessage(null);

    const confirmed = window.confirm(`Delete "${team.name}"? This will remove the team and its user assignments.`);
    if (!confirmed) return;

    setDeletingTeamId(team.id);

    try {
      const response = await authenticatedFetch(`${API_BASE}/admin/groups/${team.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Unable to delete team.");
      }

      setTeams(prev => prev.filter(item => item.id !== team.id));
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

    setIsUpdatingTeam(true);

    try {
      const groupResponse = await authenticatedFetch(`${API_BASE}/admin/groups/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editTeamName.trim(),
          description: editTeamDescription.trim() || undefined,
          isActive: true,
        }),
      });

      if (!groupResponse.ok) {
        const detail = await groupResponse.text();
        throw new Error(detail || "Unable to update team.");
      }

      const agentsResponse = await authenticatedFetch(`${API_BASE}/admin/groups/${team.id}/agents`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentNames: editTeamAgents }),
      });

      if (!agentsResponse.ok) {
        const detail = await agentsResponse.text();
        throw new Error(detail || "Unable to update team agents.");
      }

      const updatedGroup = (await groupResponse.json()) as AgentGroupListItem;

      setTeams(prev =>
        prev.map(item =>
          item.id === team.id
            ? {
                ...item,
                name: updatedGroup.name,
                description: updatedGroup.description,
                agents: editTeamAgents,
              }
            : item,
        ),
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
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <Users size={14} />
                        {typeof team.users === "number" ? `${team.users} active user` : "Assigned users managed by email"}
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
                    <label className="mb-1.5 block text-xs text-white/50">Tokens per month</label>
                    <input
                      type="number"
                      min={0}
                      value={membershipTokenLimit}
                      onChange={(event) => setMembershipTokenLimit(Number(event.target.value))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-400/60"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-xs text-white/50">Included agents</label>
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
                  <label className="mb-2 block text-xs text-white/50">Included teams</label>
                  <div className="flex flex-wrap gap-2">
                    {teams.length === 0 && (
                      <span className="text-xs text-white/35">No teams available.</span>
                    )}
                    {teams.map(team => {
                      const isSelected = membershipGroupIds.includes(team.id);
                      return (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => toggleMembershipGroup(team.id)}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                            isSelected
                              ? "border-sky-400/60 bg-sky-500/20 text-sky-200"
                              : "border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:text-white/80"
                          }`}
                        >
                          {team.name}
                        </button>
                      );
                    })}
                  </div>
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
                const chips = [
                  ...(membership.includedAgents ?? []),
                  ...(membership.includedGroupIds ?? []).map(groupId => teams.find(team => team.id === groupId)?.name ?? groupId),
                ];

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
                          <label className="mb-1.5 block text-xs text-white/50">Tokens per month</label>
                          <input
                            type="number"
                            min={0}
                            value={editMembershipTokenLimit}
                            onChange={(event) => setEditMembershipTokenLimit(Number(event.target.value))}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-400/60"
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="mb-2 block text-xs text-white/50">Included agents</label>
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
                        <label className="mb-2 block text-xs text-white/50">Included teams</label>
                        <div className="flex flex-wrap gap-2">
                          {teams.length === 0 && (
                            <span className="text-xs text-white/35">No teams available.</span>
                          )}
                          {teams.map(team => {
                            const isSelected = editMembershipGroupIds.includes(team.id);
                            return (
                              <button
                                key={team.id}
                                type="button"
                                onClick={() => toggleEditMembershipGroup(team.id)}
                                className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                                  isSelected
                                    ? "border-sky-400/60 bg-sky-500/20 text-sky-200"
                                    : "border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:text-white/80"
                                }`}
                              >
                                {team.name}
                              </button>
                            );
                          })}
                        </div>
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

                return (
                  <div key={membership.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-4">
                    <div>
                      <h3 className="font-semibold text-white/90">{membership.name}</h3>
                      <div className="mt-1 flex items-center gap-3 text-xs text-white/50">
                        <span>{membership.durationDays} Days</span>
                        <span>-</span>
                        <span>{(membership.monthlyTokenLimit / 1000).toFixed(0)}k Tokens/mo</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={() => startEditingMembership(membership)}
                        title="Edit membership"
                        className="rounded-lg p-1.5 text-white/35 transition hover:bg-emerald-500/10 hover:text-emerald-300"
                      >
                        <Pencil size={15} />
                      </button>
                      <div className="flex flex-wrap justify-end gap-1">
                        {chips.map(item => (
                          <span key={item} className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] text-sky-300">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}

              {MOCK_MEMBERSHIPS.map(membership => (
                <div key={membership.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-4">
                  <div>
                    <h3 className="font-semibold text-white/90">{membership.name}</h3>
                    <div className="text-xs text-white/50 mt-1 flex items-center gap-3">
                      <span>{membership.durationDays} Days</span>
                      <span>•</span>
                      <span>{(membership.tokens / 1000).toFixed(0)}k Tokens/mo</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button className="text-white/40 hover:text-white"><MoreVertical size={16} /></button>
                    <div className="flex gap-1">
                       {membership.items.map(item => (
                        <span key={item} className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] text-sky-300">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ──────── CONVERSATION TOKEN LIMITS ──────── */}
          <section className="rounded-2xl border border-white/10 bg-[#0F172A] p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Zap size={20} className="text-amber-400" /> Conversation Token Limits
              </h2>
            </div>
            <p className="text-xs text-white/40 mb-6">
              Set the maximum number of tokens a single conversation can reach before the user is forced to start a new one.
            </p>

            {/* Global / Per-Agent Toggle */}
            <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-white/[0.03] border border-white/5">
              <button
                onClick={() => setGlobalMode(!globalMode)}
                className="flex items-center gap-2 text-sm font-medium transition"
              >
                {globalMode ? (
                  <ToggleRight size={28} className="text-sky-400" />
                ) : (
                  <ToggleLeft size={28} className="text-white/30" />
                )}
              </button>
              <div>
                <p className="text-sm font-medium text-white/90">
                  {globalMode ? "Same limit for all agents" : "Per-agent limits"}
                </p>
                <p className="text-[11px] text-white/40">
                  {globalMode
                    ? "A single token limit applies to every agent conversation."
                    : "Each agent can have its own conversation token limit."}
                </p>
              </div>
            </div>

            {/* Global Limit Input */}
            {globalMode ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Max Tokens per Conversation (All Agents)</label>
                  <div className="relative max-w-xs">
                    <Zap size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400/60" />
                    <input
                      type="number"
                      value={globalLimit}
                      onChange={(e) => setGlobalLimit(Number(e.target.value))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 p-3 pl-9 text-sm text-white outline-none focus:border-amber-500/50 transition"
                    />
                  </div>
                  <p className="text-[11px] text-white/30 mt-2">
                    Equivalent to ~{(globalLimit / 750).toFixed(0)} pages of text or ~{(globalLimit / 4).toFixed(0)} words.
                  </p>
                </div>
              </div>
            ) : (
              /* Per-Agent Limits Table */
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-[1fr_140px_100px] gap-3 px-3 py-2 text-[10px] uppercase tracking-wider text-white/30 sticky top-0 bg-[#0F172A] z-10">
                  <span>Agent</span>
                  <span>Max Tokens</span>
                  <span className="text-right">~Words</span>
                </div>
                {SINGLE_AGENTS.map(agent => (
                  <div
                    key={agent}
                    className="grid grid-cols-[1fr_140px_100px] gap-3 items-center rounded-lg bg-white/[0.03] px-3 py-2.5 border border-white/5 hover:border-white/10 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-500/15 text-sky-400">
                        <Bot size={13} />
                      </div>
                      <span className="text-sm font-medium text-white/80">{agent}</span>
                    </div>
                    <input
                      type="number"
                      value={perAgentLimits[agent] || 8000}
                      onChange={(e) => updateAgentLimit(agent, Number(e.target.value))}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white outline-none focus:border-amber-500/50 transition text-center"
                    />
                    <span className="text-xs text-white/30 font-mono text-right">
                      {((perAgentLimits[agent] || 8000) / 4).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button className="flex items-center gap-2 rounded-xl bg-amber-600/90 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-500 shadow-lg shadow-amber-500/15">
                <Save size={14} /> Save Limits
              </button>
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
