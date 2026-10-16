"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2, Search, Plus, Layers, Users, CalendarClock, ChevronRight,
  CheckCircle2, AlertTriangle, CreditCard, Trash2, Pencil, Save,
} from "lucide-react";
import AgencyDetail, { ErrorBox, Modal, SeatBar, agencyStatusBadge, inputCls, labelCls } from "./AgencyDetail";
import {
  Agency, AgencyMembership, AgencyStatus,
  daysUntil, formatDate, formatTokens, totalInUse, totalSeats,
} from "./agencyTypes";
import {
  AGENT_OPTIONS, AgencyMembershipInput, TeamOption, archiveAgencyMembership, createAgencyMembership,
  fetchAgencyMemberships, fetchTeamOptions, updateAgencyMembership,
} from "./agencyMembershipsApi";
import { createAgency, fetchAgencies, fetchAgency, todayIso } from "./agenciesApi";

export default function AgenciesPage() {
  // Everything on this page is saved on the server.
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [agenciesLoading, setAgenciesLoading] = useState(true);
  const [agenciesError, setAgenciesError] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<AgencyMembership[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(true);
  const [membershipsError, setMembershipsError] = useState<string | null>(null);
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);
  const [showMemberships, setShowMemberships] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AgencyStatus>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const today = todayIso();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const selected = agencies.find((a) => a.id === selectedId) ?? null;

  // The list comes without ledger and activity; opening an agency loads them.
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    fetchAgency(selectedId)
      .then((full) => { if (!cancelled) setAgencies((list) => list.map((a) => (a.id === full.id ? full : a))); })
      .catch((e) => { if (!cancelled) setDetailError(e instanceof Error ? e.message : "Unable to load the agency."); });
    return () => { cancelled = true; };
  }, [selectedId]);

  const stats = useMemo(() => {
    const seats = agencies.reduce((s, a) => s + totalSeats(a), 0);
    const inUse = agencies.reduce((s, a) => s + totalInUse(a), 0);
    const expiring = agencies.flatMap((a) => a.pools).filter((p) => {
      const d = daysUntil(p.validUntil, today);
      return d >= 0 && d <= 30;
    }).length;
    return { count: agencies.length, seats, inUse, expiring };
  }, [agencies, today]);

  const rows = agencies.filter(
    (a) =>
      (statusFilter === "all" || a.status === statusFilter) &&
      [a.name, a.owner.name, a.owner.email, ...a.pools.map((p) => p.membership)].join(" ").toLowerCase().includes(query.toLowerCase()),
  );

  const updateAgency = (next: Agency) => setAgencies((list) => list.map((a) => (a.id === next.id ? next : a)));

  const addAgency = async (input: Parameters<typeof createAgency>[0]) => {
    const created = await createAgency(input);
    setAgencies((list) => [created, ...list]);
    setToast(`${created.name} created with ${input.seats} ${created.pools[0]?.membership ?? ""} seats`);
  };

  const removeAgency = (agency: Agency) => {
    setSelectedId(null);
    setAgencies((list) => list.filter((a) => a.id !== agency.id));
    setToast(`${agency.name} archived`);
  };

  useEffect(() => {
    let cancelled = false;
    fetchAgencies()
      .then((list) => { if (!cancelled) setAgencies(list); })
      .catch((e) => { if (!cancelled) setAgenciesError(e instanceof Error ? e.message : "Unable to load agencies."); })
      .finally(() => { if (!cancelled) setAgenciesLoading(false); });
    fetchAgencyMemberships()
      .then((list) => { if (!cancelled) setMemberships(list); })
      .catch((e) => { if (!cancelled) setMembershipsError(e instanceof Error ? e.message : "Unable to load agency memberships."); })
      .finally(() => { if (!cancelled) setMembershipsLoading(false); });
    // Teams only feed the picker; the window still works with agents alone.
    fetchTeamOptions()
      .then((list) => { if (!cancelled) setTeamOptions(list); })
      .catch((e) => console.error("Unable to load teams:", e));
    return () => { cancelled = true; };
  }, []);

  const addMembership = async (input: AgencyMembershipInput) => {
    const created = await createAgencyMembership(input);
    setMemberships((list) => [...list, created]);
    setToast(`${created.name} membership created`);
  };

  const editMembership = async (id: string, input: AgencyMembershipInput) => {
    const updated = await updateAgencyMembership(id, input);
    setMemberships((list) => list.map((m) => (m.id === id ? updated : m)));
    setToast(`${updated.name} membership updated`);
  };

  const removeMembership = async (m: AgencyMembership) => {
    await archiveAgencyMembership(m.id);
    setMemberships((list) => list.filter((x) => x.id !== m.id));
    setToast(`${m.name} membership removed`);
  };

  return (
    <div className="mx-auto max-w-[1600px] p-8">
      {selected ? (
        <>
          {detailError && <div className="mb-4"><ErrorBox>{detailError}</ErrorBox></div>}
          <AgencyDetail
            agency={selected}
            memberships={memberships}
            onBack={() => setSelectedId(null)}
            onChange={updateAgency}
            onArchived={removeAgency}
            onToast={setToast}
          />
        </>
      ) : (
        <>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Agencies</h1>
              <p className="text-sm text-white/50">Agencies resell memberships through seat pools they manage themselves</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowMemberships(true)}
                className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
              >
                <CreditCard size={16} /> Agency memberships
                <span className="rounded bg-white/10 px-1.5 text-[10px] text-white/50">{memberships.length}</span>
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-500"
              >
                <Plus size={16} /> New agency
              </button>
            </div>
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

          {/* Filters */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
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
          </div>

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
                    const left = nextExpiry ? daysUntil(nextExpiry.validUntil, today) : 0;
                    const tokens = a.clients.filter((c) => c.status !== "archived").reduce((s, c) => s + c.tokensUsed, 0);
                    const customerCount = a.clients.filter((c) => c.status !== "archived").length;
                    return (
                      <tr
                        key={a.id}
                        onClick={() => { setDetailError(null); setSelectedId(a.id); }}
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
                          {nextExpiry ? (
                            <>
                              <p>{formatDate(nextExpiry.validUntil)}</p>
                              <p className={left < 0 ? "text-red-400" : left <= 30 ? "text-amber-400" : "text-white/30"}>
                                {left < 0 ? `expired ${-left}d ago` : `${left}d left`}
                              </p>
                            </>
                          ) : (
                            <span className="text-white/30">No pool</span>
                          )}
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
                  {agenciesLoading && (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-white/40">Loading agencies…</td></tr>
                  )}
                  {!agenciesLoading && agenciesError && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-red-300">
                        <AlertTriangle size={16} className="mr-2 inline" />{agenciesError}
                      </td>
                    </tr>
                  )}
                  {!agenciesLoading && !agenciesError && rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-white/40">
                        {agencies.length === 0 ? "No agencies yet. Create the first one with New agency." : "No agencies match your filters."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showCreate && (
        <CreateAgencyModal
          memberships={memberships}
          onClose={() => setShowCreate(false)}
          onSave={async (input) => { await addAgency(input); setShowCreate(false); }}
          onManageMemberships={() => { setShowCreate(false); setShowMemberships(true); }}
        />
      )}

      {showMemberships && (
        <MembershipsModal
          memberships={memberships}
          loading={membershipsLoading}
          loadError={membershipsError}
          teamOptions={teamOptions}
          onAdd={addMembership}
          onUpdate={editMembership}
          onRemove={removeMembership}
          onClose={() => setShowMemberships(false)}
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

function MembershipsModal({
  memberships, loading, loadError, teamOptions, onAdd, onUpdate, onRemove, onClose,
}: {
  memberships: AgencyMembership[];
  loading: boolean;
  loadError: string | null;
  teamOptions: TeamOption[];
  onAdd: (input: AgencyMembershipInput) => Promise<void>;
  onUpdate: (id: string, input: AgencyMembershipInput) => Promise<void>;
  onRemove: (m: AgencyMembership) => Promise<void>;
  onClose: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [agents, setAgents] = useState<string[]>([]);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [tokens, setTokens] = useState(400_000);
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const duplicate = memberships.some((m) => m.id !== editingId && m.name.toLowerCase() === name.trim().toLowerCase());
  const valid = name.trim() && !duplicate && agents.length + teamIds.length > 0 && tokens > 0 && !saving;

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) =>
    setter((list) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]));

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setAgents([]);
    setTeamIds([]);
    setTokens(400_000);
    setError(null);
  };

  const startEdit = (m: AgencyMembership) => {
    setEditingId(m.id);
    setName(m.name);
    setAgents(m.singleAgents);
    setTeamIds(m.teamIds);
    setTokens(m.monthlyTokenLimit);
    setConfirmId(null);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const input = {
      name: name.trim(),
      includedAgents: AGENT_OPTIONS.filter((a) => agents.includes(a)),
      includedTeamIds: teamIds,
      monthlyTokenLimit: tokens,
    };
    try {
      if (editingId) await onUpdate(editingId, input);
      else await onAdd(input);
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Unable to ${editingId ? "update" : "create"} the membership.`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m: AgencyMembership) => {
    setRemovingId(m.id);
    setError(null);
    try {
      await onRemove(m);
      if (editingId === m.id) resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to remove the membership.");
    } finally {
      setRemovingId(null);
      setConfirmId(null);
    }
  };

  const chip = (on: boolean) =>
    `rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
      on ? "border-indigo-400/50 bg-indigo-500/25 text-indigo-200" : "border-white/10 text-white/50 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <Modal title="Agency memberships" subtitle="The plans agencies can buy seat pools of. Saved on the server." onClose={onClose} width="max-w-2xl">
      <div className="space-y-5">
        <div className="space-y-2">
          {loading && <p className="p-4 text-center text-sm text-white/40">Loading…</p>}
          {!loading && loadError && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{loadError}</p>
          )}
          {memberships.map((m) => (
            <div
              key={m.id}
              className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${
                editingId === m.id ? "border-sky-400/40 bg-sky-500/[0.06]" : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{m.name}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {m.agents.map((a) => (
                    <span key={a} className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">{a}</span>
                  ))}
                  <span className="ml-1 text-[10px] text-white/40">{formatTokens(m.monthlyTokenLimit)} tokens / seat / 30d</span>
                </div>
              </div>
              {confirmId === m.id ? (
                <div className="flex flex-shrink-0 items-center gap-2 text-xs">
                  <span className="text-white/50">Remove?</span>
                  <button
                    onClick={() => remove(m)}
                    disabled={removingId === m.id}
                    className="rounded-lg bg-red-500/15 px-2 py-1 font-medium text-red-300 transition hover:bg-red-500/25 disabled:opacity-50"
                  >
                    {removingId === m.id ? "Removing…" : "Yes"}
                  </button>
                  <button onClick={() => setConfirmId(null)} className="rounded-lg px-2 py-1 text-white/50 transition hover:bg-white/5">No</button>
                </div>
              ) : (
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    onClick={() => startEdit(m)}
                    title="Edit membership"
                    className="rounded-lg p-1.5 text-white/40 transition hover:bg-sky-500/10 hover:text-sky-300"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setConfirmId(m.id)}
                    title="Remove membership"
                    className="rounded-lg p-1.5 text-white/40 transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {!loading && !loadError && memberships.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-white/40">No agency memberships yet.</p>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="mb-3 text-[10px] uppercase tracking-widest text-white/30">
            {editingId ? `Edit membership · ${memberships.find((m) => m.id === editingId)?.name ?? ""}` : "New membership"}
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Agency Plus" className={inputCls} />
                {duplicate && <p className="mt-1 text-[11px] text-red-400">A membership with this name already exists.</p>}
              </div>
              <div>
                <label className={labelCls}>Tokens per seat / 30 days</label>
                <input type="number" min={1} step={10_000} value={tokens} onChange={(e) => setTokens(Math.max(1, Number(e.target.value) || 1))} className={inputCls} />
              </div>
            </div>
            {teamOptions.length > 0 && (
              <div>
                <label className={labelCls}>Teams</label>
                <div className="flex flex-wrap gap-1.5">
                  {teamOptions.map((t) => (
                    <button key={t.id} type="button" onClick={() => toggle(setTeamIds, t.id)} className={chip(teamIds.includes(t.id))}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className={labelCls}>Agents</label>
              <div className="flex flex-wrap gap-1.5">
                {AGENT_OPTIONS.map((a) => (
                  <button key={a} type="button" onClick={() => toggle(setAgents, a)} className={chip(agents.includes(a))}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">{error}</p>}
            <div className="flex gap-2">
              {editingId && (
                <button
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
                >
                  Cancel
                </button>
              )}
              <button
                disabled={!valid}
                onClick={save}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {editingId ? (
                  <><Save size={16} /> {saving ? "Saving…" : "Save changes"}</>
                ) : (
                  <><Plus size={16} /> {saving ? "Creating…" : "Create membership"}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function CreateAgencyModal({
  memberships, onClose, onSave, onManageMemberships,
}: {
  memberships: AgencyMembership[];
  onClose: () => void;
  onSave: (input: Parameters<typeof createAgency>[0]) => Promise<void>;
  onManageMemberships: () => void;
}) {
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [country, setCountry] = useState("Italy");
  const [membershipId, setMembershipId] = useState(memberships[0]?.id ?? "");
  const [seats, setSeats] = useState(10);
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Falls back to the first one if the list loaded after the form opened.
  const tpl = memberships.find((m) => m.id === membershipId) ?? memberships[0];
  const valid = name.trim() && ownerName.trim() && /\S+@\S+\.\S+/.test(ownerEmail) && seats > 0 && tpl && validUntil && !saving;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim(),
        country: country.trim(),
        agencyMembershipId: tpl!.id,
        seats,
        validUntil,
        note: note.trim(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create the agency.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New agency" subtitle="Creates the agency, its owner (as staff) and a first seat pool." onClose={onClose} width="max-w-lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Agency name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Agency Z" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Country</label>
            <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Italy" className={inputCls} />
          </div>
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
              <select value={tpl?.id ?? ""} onChange={(e) => setMembershipId(e.target.value)} className={inputCls}>
                {memberships.map((m) => <option key={m.id} value={m.id} className="bg-[#0B1221]">{m.name}</option>)}
              </select>
              {tpl && (
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {tpl.agents.map((a) => (
                    <span key={a} className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">{a}</span>
                  ))}
                  <span className="ml-1 text-[10px] text-white/40">{formatTokens(tpl.monthlyTokenLimit)} tokens / seat / 30d</span>
                </div>
              )}
              <button type="button" onClick={onManageMemberships} className="mt-2 text-xs font-medium text-sky-400 transition hover:text-sky-300">
                + New agency membership
              </button>
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

        {error && <ErrorBox>{error}</ErrorBox>}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/60 transition hover:bg-white/5">Cancel</button>
          <button
            disabled={!valid}
            onClick={save}
            className="flex-1 rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Creating…" : "Create agency"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
