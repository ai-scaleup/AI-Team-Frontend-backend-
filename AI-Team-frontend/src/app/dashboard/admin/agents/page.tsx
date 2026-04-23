"use client";

import { useState } from "react";
import { Bot, Users, Plus, ShieldCheck, MoreVertical, Search, CreditCard } from "lucide-react";

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

export default function AgentsAndTeamsPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredAgents = SINGLE_AGENTS.filter(a => a.toLowerCase().includes(searchTerm.toLowerCase()));

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
