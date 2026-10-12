"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2, Search, Plus, Layers, Users, CalendarClock, ChevronRight,
  Sparkles, ScrollText, CheckCircle2,
} from "lucide-react";
import AgencyDetail, { ActivityTab, Modal, SeatBar, agencyStatusBadge, inputCls, labelCls } from "./AgencyDetail";
import {
  AGENCY_MEMBERSHIPS, Agency, AgencyStatus, DEMO_TODAY, INITIAL_AGENCIES,
  daysUntil, formatDate, formatTokens, totalInUse, totalSeats,
} from "./mockData";

type View = "agencies" | "activity";

export default function AgenciesPage() {
  const [agencies, setAgencies] = useState<Agency[]>(INITIAL_AGENCIES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>("agencies");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AgencyStatus>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const selected = agencies.find((a) => a.id === selectedId) ?? null;

  const stats = useMemo(() => {
    const seats = agencies.reduce((s, a) => s + totalSeats(a), 0);
    const inUse = agencies.reduce((s, a) => s + totalInUse(a), 0);
    const expiring = agencies.flatMap((a) => a.pools).filter((p) => {
      const d = daysUntil(p.validUntil);
      return d >= 0 && d <= 30;
    }).length;
    return { count: agencies.length, seats, inUse, expiring };
  }, [agencies]);

  const rows = agencies.filter(
    (a) =>
      (statusFilter === "all" || a.status === statusFilter) &&
      [a.name, a.owner.name, a.owner.email, ...a.pools.map((p) => p.membership)].join(" ").toLowerCase().includes(query.toLowerCase()),
  );

  const allActivity = useMemo(
    () =>
      agencies
        .flatMap((a) => a.activity.map((e) => ({ ...e, agency: a.name })))
        .sort((x, y) => y.date.localeCompare(x.date)),
    [agencies],
  );

  const updateAgency = (next: Agency) => setAgencies((list) => list.map((a) => (a.id === next.id ? next : a)));

  const createAgency = (name: string, ownerName: string, ownerEmail: string, membership: string, seats: number, validUntil: string, note: string) => {
    const tpl = AGENCY_MEMBERSHIPS.find((m) => m.name === membership)!;
    const id = `ag-${Math.random().toString(36).slice(2, 8)}`;
    const poolId = `${id}-pool`;
    const agency: Agency = {
      id,
      name,
      owner: { name: ownerName, email: ownerEmail },
      status: "active",
      createdOn: DEMO_TODAY,
      country: "Italy",
      pools: [{ id: poolId, membership, agents: tpl.agents, monthlyTokenLimit: tpl.monthlyTokenLimit, validFrom: DEMO_TODAY, validUntil, seats }],
      clients: [],
      ledger: [{ id: `${id}-l1`, date: DEMO_TODAY, poolId, change: seats, reason: "Prepaid pack granted", by: "digitalcoachai@gmail.com", note: note || undefined }],
      activity: [{ id: `${id}-a1`, date: `${DEMO_TODAY} 12:00`, actor: "digitalcoachai@gmail.com", action: "Created agency", target: name }],
      staff: [{ id: `${id}-s1`, name: ownerName, email: ownerEmail, role: "owner" }],
    };
    setAgencies((list) => [agency, ...list]);
    setToast(`${name} created with ${seats} ${membership} seats`);
  };

  return (
    <div className="mx-auto max-w-[1600px] p-8">
      <DemoRibbon />

      {selected ? (
        <AgencyDetail agency={selected} onBack={() => setSelectedId(null)} onChange={updateAgency} onToast={setToast} />
      ) : (
        <>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Agencies</h1>
              <p className="text-sm text-white/50">Agencies resell memberships through seat pools they manage themselves</p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-500"
            >
              <Plus size={16} /> New agency
            </button>
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Building2} tone="bg-sky-500/15 text-sky-400" label="Agencies" value={String(stats.count)} />
            <StatCard icon={Layers} tone="bg-indigo-500/15 text-indigo-400" label="Seats sold" value={String(stats.seats)} />
            <StatCard
              icon={Users}
              tone="bg-emerald-500/15 text-emerald-400"
              label="Seats in use"
              value={`${stats.inUse}`}
              suffix={`${stats.seats ? Math.round((stats.inUse / stats.seats) * 100) : 0}% utilisation`}
            />
            <StatCard icon={CalendarClock} tone="bg-amber-500/15 text-amber-400" label="Pools expiring ≤ 30d" value={String(stats.expiring)} />
          </div>

          {/* View switch + filters */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="flex rounded-xl border border-white/10 bg-[#0F172A] p-1">
              {([["agencies", "Agencies", Building2], ["activity", "Activity log", ScrollText]] as const).map(([id, label, Icon]) => (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    view === id ? "bg-sky-500/20 text-sky-300" : "text-white/50 hover:text-white"
                  }`}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
            {view === "agencies" && (
              <>
                <div className="relative min-w-[240px] max-w-md flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by agency, owner, membership..."
                    className="w-full rounded-xl border border-white/10 bg-[#0F172A] py-2.5 pl-9 pr-4 text-sm text-white placeholder-white/40 transition focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | AgencyStatus)}
                  className="rounded-xl border border-white/10 bg-[#0F172A] px-3 py-2.5 pr-8 text-sm text-white/70 outline-none transition hover:bg-white/5"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="grace">Grace period</option>
                  <option value="suspended">Suspended</option>
                </select>
              </>
            )}
          </div>

          {view === "activity" ? (
            <ActivityTab entries={allActivity} showAgency />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0F172A]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-white/70">
                  <thead className="border-b border-white/10 bg-white/5 text-[10px] uppercase tracking-wider text-white/40">
                    <tr>
                      <th className="px-4 py-4 font-semibold">Agency</th>
                      <th className="px-4 py-4 font-semibold">Owner</th>
                      <th className="px-4 py-4 font-semibold">Seat pools</th>
                      <th className="px-4 py-4 font-semibold">Seats in use</th>
                      <th className="px-4 py-4 font-semibold">Valid until</th>
                      <th className="px-4 py-4 font-semibold">Status</th>
                      <th className="px-4 py-4 text-right font-semibold">Tokens this cycle</th>
                      <th className="px-4 py-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => {
                      const seats = totalSeats(a);
                      const used = totalInUse(a);
                      const nextExpiry = [...a.pools].sort((x, y) => x.validUntil.localeCompare(y.validUntil))[0];
                      const left = daysUntil(nextExpiry.validUntil);
                      const tokens = a.clients.filter((c) => c.status !== "archived").reduce((s, c) => s + c.tokensUsed, 0);
                      const customerCount = a.clients.filter((c) => c.status !== "archived").length;
                      return (
                        <tr
                          key={a.id}
                          onClick={() => setSelectedId(a.id)}
                          className="group cursor-pointer border-b border-white/5 transition hover:bg-white/[0.03]"
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500/25 to-indigo-500/25 text-xs font-bold text-sky-300">
                                {a.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                              </div>
                              <div>
                                <p className="font-medium text-white transition group-hover:text-sky-400">{a.name}</p>
                                <p className="text-xs text-white/40">{customerCount} {customerCount === 1 ? "customer" : "customers"} · {a.staff.length} staff</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-xs text-white">{a.owner.name}</p>
                            <p className="text-xs text-white/40">{a.owner.email}</p>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex max-w-[220px] flex-wrap gap-1">
                              {a.pools.map((p) => (
                                <span key={p.id} className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">{p.membership}</span>
                              ))}
                            </div>
                          </td>
                          <td className="w-44 px-4 py-4">
                            <p className="mb-1.5 font-mono text-xs">
                              <span className="text-white">{used}</span> <span className="text-white/30">/ {seats}</span>
                            </p>
                            <SeatBar used={used} total={seats} />
                          </td>
                          <td className="px-4 py-4 text-xs">
                            <p>{formatDate(nextExpiry.validUntil)}</p>
                            <p className={left < 0 ? "text-red-400" : left <= 30 ? "text-amber-400" : "text-white/30"}>
                              {left < 0 ? `expired ${-left}d ago` : `${left}d left`}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize ${agencyStatusBadge(a.status)}`}>{a.status}</span>
                          </td>
                          <td className="px-4 py-4 text-right font-mono text-sky-300">{formatTokens(tokens)}</td>
                          <td className="px-4 py-4 text-right">
                            <ChevronRight size={16} className="ml-auto text-white/20 transition group-hover:translate-x-0.5 group-hover:text-sky-400" />
                          </td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-white/40">No agencies match your filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {showCreate && (
        <CreateAgencyModal
          onClose={() => setShowCreate(false)}
          onSave={(...args) => { createAgency(...args); setShowCreate(false); }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-xl border border-emerald-500/30 bg-[#0B1221] px-4 py-3 text-sm text-emerald-300 shadow-2xl shadow-black/50">
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}
    </div>
  );
}

function DemoRibbon() {
  return (
    <div className="mb-6 flex items-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-2.5 text-xs text-indigo-200">
      <Sparkles size={14} className="flex-shrink-0 text-indigo-300" />
      Design demo with sample data. Nothing here is saved or sent to the server — changes reset when you reload.
    </div>
  );
}

function StatCard({
  icon: Icon, tone, label, value, suffix,
}: {
  icon: React.ElementType; tone: string; label: string; value: string; suffix?: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}><Icon size={20} /></div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/35">{label}</p>
        <p className="text-xl font-bold">
          {value}
          {suffix && <span className="ml-2 text-xs font-normal text-white/40">{suffix}</span>}
        </p>
      </div>
    </div>
  );
}

function CreateAgencyModal({
  onClose, onSave,
}: {
  onClose: () => void;
  onSave: (name: string, ownerName: string, ownerEmail: string, membership: string, seats: number, validUntil: string, note: string) => void;
}) {
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [membership, setMembership] = useState(AGENCY_MEMBERSHIPS[0].name);
  const [seats, setSeats] = useState(10);
  const [validUntil, setValidUntil] = useState("2027-10-11");
  const [note, setNote] = useState("");
  const tpl = AGENCY_MEMBERSHIPS.find((m) => m.name === membership)!;
  const valid = name.trim() && ownerName.trim() && /\S+@\S+\.\S+/.test(ownerEmail) && seats > 0;

  return (
    <Modal title="New agency" subtitle="Creates the agency, its owner login and a first seat pool." onClose={onClose} width="max-w-lg">
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Agency name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Agency Z" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Owner name</label>
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Owner email</label>
            <input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="owner@agency.it" className={inputCls} />
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="mb-3 text-[10px] uppercase tracking-widest text-white/30">First seat pool</p>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Agency membership</label>
              <select value={membership} onChange={(e) => setMembership(e.target.value)} className={inputCls}>
                {AGENCY_MEMBERSHIPS.map((m) => <option key={m.name} className="bg-[#0B1221]">{m.name}</option>)}
              </select>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {tpl.agents.map((a) => (
                  <span key={a} className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">{a}</span>
                ))}
                <span className="ml-1 text-[10px] text-white/40">{formatTokens(tpl.monthlyTokenLimit)} tokens / seat / 30d</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Seats</label>
                <input type="number" min={1} value={seats} onChange={(e) => setSeats(Math.max(1, Number(e.target.value) || 1))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Pool valid until</label>
                <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Note (invoice number)</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="INV-2026-0450" className={inputCls} />
            </div>
          </div>
        </div>
        <p className="text-xs text-white/40">Only memberships flagged for agencies can back a pool.</p>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/60 transition hover:bg-white/5">Cancel</button>
          <button
            disabled={!valid}
            onClick={() => onSave(name.trim(), ownerName.trim(), ownerEmail.trim(), membership, seats, validUntil, note.trim())}
            className="flex-1 rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Create agency
          </button>
        </div>
      </div>
    </Modal>
  );
}
