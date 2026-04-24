"use client";

import { useState } from "react";
import {
  Bot, Users, Plus, ShieldCheck, MoreVertical, Search, CreditCard,
  AlertTriangle, ToggleLeft, ToggleRight, Trash2, MessageSquare, Save, Zap
} from "lucide-react";

// Mock Data
const SINGLE_AGENTS = [
  "SARA_AI", "JENNIFER_AI", "CHIARA_AI", "JIM", "ALEX", "MIKE", "TONY", 
  "LARA", "VALENTINA", "DANIELE", "SIMONE", "NIKO", "ALADINO", "LAURA", "DAN"
];

const MOCK_TEAMS = [
  { id: 1, name: "Marketing Powerhouse", agents: ["SARA_AI", "JENNIFER_AI", "JIM"], users: 142 },
  { id: 2, name: "Sales Closers", agents: ["ALEX", "MIKE", "TONY", "CHIARA_AI"], users: 89 },
  { id: 3, name: "Customer Support Tier 1", agents: ["LARA", "VALENTINA", "DANIELE"], users: 312 },
];

const MOCK_MEMBERSHIPS = [
  { id: 1, name: "1 year Sara AI", durationDays: 365, tokens: 500000, items: ["SARA_AI"] },
  { id: 2, name: "3 months Ai Team", durationDays: 90, tokens: 2000000, items: ["Marketing Powerhouse", "Sales Closers"] },
  { id: 3, name: "Starter Bundle", durationDays: 30, tokens: 100000, items: ["JIM", "ALEX", "MIKE"] },
];

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

  // Conversation Limits state
  const [globalMode, setGlobalMode] = useState(true);
  const [globalLimit, setGlobalLimit] = useState(16000);
  const [perAgentLimits, setPerAgentLimits] = useState<Record<string, number>>({ ...DEFAULT_PER_AGENT_LIMITS });

  // Alert Thresholds state
  const [alerts, setAlerts] = useState<AlertThreshold[]>([...DEFAULT_ALERTS]);

  const filteredAgents = SINGLE_AGENTS.filter(a => a.toLowerCase().includes(searchTerm.toLowerCase()));

  const updateAgentLimit = (agent: string, value: number) => {
    setPerAgentLimits(prev => ({ ...prev, [agent]: value }));
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
          <section className="rounded-2xl border border-white/10 bg-[#0F172A] p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Users size={20} className="text-indigo-400" /> Agent Teams
              </h2>
              <button className="flex items-center gap-2 rounded-xl bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-400 transition hover:bg-indigo-500/20">
                <Plus size={16} /> Create Team
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MOCK_TEAMS.map(team => (
                <div key={team.id} className="rounded-xl border border-white/5 bg-white/5 p-4 hover:bg-white/10 transition">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white/90">{team.name}</h3>
                    <button className="text-white/40 hover:text-white"><MoreVertical size={16} /></button>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {team.agents.map(agent => (
                      <span key={agent} className="rounded-md bg-white/10 px-2 py-1 text-xs text-white/70">
                        {agent}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/40">
                    <Users size={14} /> {team.users} active users
                  </div>
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
              <button className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/20">
                <Plus size={16} /> Create Membership
              </button>
            </div>

            <div className="space-y-3">
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
        <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-6 h-max">
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

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
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
