"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowLeftRight, Plus, Minus, X, ExternalLink, UserPlus, Power,
  RotateCcw, AlertTriangle, ShieldCheck, Mail, Search, Bot, MessageSquare,
  BookOpen, Activity, Users, Layers, ScrollText, Gauge, CalendarClock,
} from "lucide-react";
import {
  Agency, AgencyClient, ActivityEntry, LedgerEntry, SeatPool, StaffRole,
  DEMO_TODAY, daysUntil, formatDate, formatTokens, seatsInUse,
} from "./mockData";

const ADMIN_EMAIL = "digitalcoachai@gmail.com";

type Tab = "customers" | "seats" | "usage" | "staff" | "activity";

const nowStamp = () => {
  const d = new Date();
  return `${DEMO_TODAY} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const uid = () => Math.random().toString(36).slice(2, 9);

/* ──────────────── SHARED UI ──────────────── */

export const agencyStatusBadge = (status: Agency["status"]) =>
  status === "active"
    ? "bg-emerald-500/15 text-emerald-400"
    : status === "grace"
      ? "bg-amber-500/15 text-amber-400"
      : "bg-red-500/15 text-red-400";

const clientStatusBadge = (status: AgencyClient["status"]) =>
  status === "active"
    ? "bg-emerald-500/15 text-emerald-400"
    : status === "invited"
      ? "bg-sky-500/15 text-sky-400"
      : "bg-white/10 text-white/40";

export const roleBadge: Record<StaffRole, string> = {
  owner: "bg-indigo-500/20 text-indigo-300",
  manager: "bg-sky-500/15 text-sky-300",
  operator: "bg-teal-500/15 text-teal-300",
  viewer: "bg-white/10 text-white/50",
};

export const roleHint: Record<StaffRole, string> = {
  owner: "Everything, including billing",
  manager: "Seats and customers",
  operator: "Opens customer workspaces only",
  viewer: "Reports only",
};

export function SeatBar({ used, total, className = "" }: { used: number; total: number; className?: string }) {
  const pct = total ? Math.min(100, (used / total) * 100) : 0;
  const full = used >= total;
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-white/10 ${className}`}>
      <div
        className={`h-full rounded-full ${full ? "bg-amber-400" : "bg-gradient-to-r from-sky-500 to-indigo-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Modal({
  title, subtitle, onClose, children, width = "max-w-md",
}: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; width?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`w-full ${width} rounded-2xl border border-white/10 bg-[#0B1221] p-6 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-white/50">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-sky-500";
export const labelCls = "mb-1 block text-xs text-white/50";
export const primaryBtn =
  "flex-1 rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40";
export const secondaryBtn = "flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/60 transition hover:bg-white/5";

export function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
      <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-xs leading-relaxed text-sky-200">{children}</div>
  );
}

/* ──────────────── ACTIONS (local state only) ──────────────── */

/** Every agency action, shared by the admin view and the agency portal. */
export function agencyActions(
  agency: Agency,
  onChange: (next: Agency) => void,
  onToast: (msg: string) => void,
  actor: string,
) {
  const poolById = (id: string) => agency.pools.find((p) => p.id === id)!;

  const log = (entry: Omit<ActivityEntry, "id" | "date">): ActivityEntry => ({ id: uid(), date: nowStamp(), ...entry });

  /* ── actions (local state only) ── */

  const adjustSeats = (pool: SeatPool, change: number, reason: string, note: string) => {
    const ledgerEntry: LedgerEntry = { id: uid(), date: DEMO_TODAY, poolId: pool.id, change, reason, by: actor, note: note || undefined };
    onChange({
      ...agency,
      pools: agency.pools.map((p) => (p.id === pool.id ? { ...p, seats: p.seats + change } : p)),
      ledger: [...agency.ledger, ledgerEntry],
      activity: [log({ actor, action: `${change > 0 ? "Granted" : "Removed"} seats ${change > 0 ? "+" : ""}${change}`, target: `${pool.membership} pool` }), ...agency.activity],
    });
    onToast(`${pool.membership}: ${change > 0 ? "+" : ""}${change} seats recorded in the ledger`);
  };

  const activate = (company: string, email: string, poolId: string, sendInvite: boolean) => {
    const client: AgencyClient = {
      id: uid(), company, email, poolId, status: sendInvite ? "invited" : "active",
      tokensUsed: 0, cycleStart: DEMO_TODAY, lastActive: null, swappedThisCycle: false,
    };
    onChange({
      ...agency,
      clients: [client, ...agency.clients],
      activity: [log({ actor, action: sendInvite ? "Invited customer" : "Activated customer", target: company }), ...agency.activity],
    });
    onToast(`${company} now holds a seat${sendInvite ? " — invitation sent" : ""}`);
  };

  const deactivate = (client: AgencyClient) => {
    onChange({
      ...agency,
      clients: agency.clients.map((c) => (c.id === client.id ? { ...c, status: "archived", archivedOn: DEMO_TODAY } : c)),
      activity: [log({ actor, action: "Deactivated customer", target: client.company }), ...agency.activity],
    });
    onToast(`${client.company} archived — seat freed`);
  };

  const restore = (client: AgencyClient) => {
    const pool = poolById(client.poolId);
    if (seatsInUse(agency, pool.id) >= pool.seats) {
      onToast(`No free seat in ${pool.membership} — free one first`);
      return;
    }
    onChange({
      ...agency,
      clients: agency.clients.map((c) => (c.id === client.id ? { ...c, status: "active", archivedOn: undefined } : c)),
      activity: [log({ actor, action: "Restored customer", target: client.company }), ...agency.activity],
    });
    onToast(`${client.company} restored`);
  };

  const substitute = (outgoing: AgencyClient, company: string, email: string, override: boolean) => {
    const incoming: AgencyClient = {
      id: uid(), company, email, poolId: outgoing.poolId, status: "invited",
      tokensUsed: outgoing.tokensUsed, cycleStart: outgoing.cycleStart, lastActive: null, swappedThisCycle: true,
    };
    onChange({
      ...agency,
      clients: [
        incoming,
        ...agency.clients.map((c) => (c.id === outgoing.id ? { ...c, status: "archived" as const, archivedOn: DEMO_TODAY } : c)),
      ],
      activity: [
        log({ actor, action: override ? "Substituted customer (admin override)" : "Substituted customer", target: `${outgoing.company} → ${company}` }),
        ...agency.activity,
      ],
    });
    onToast(`Seat moved from ${outgoing.company} to ${company}`);
  };

  const inviteStaff = (name: string, email: string, role: StaffRole) => {
    onChange({
      ...agency,
      staff: [...agency.staff, { id: uid(), name, email, role }],
      activity: [log({ actor, action: `Invited staff (${role})`, target: email }), ...agency.activity],
    });
    onToast(`${name} invited as ${role}`);
  };

  const logWorkspaceOpen = (client: AgencyClient, by: string) => {
    onChange({
      ...agency,
      activity: [log({ actor: by, actingAs: client.company, action: "Opened workspace", target: client.company }), ...agency.activity],
    });
  };

  return { adjustSeats, activate, deactivate, restore, substitute, inviteStaff, logWorkspaceOpen };
}

/* ──────────────── MAIN ──────────────── */

export default function AgencyDetail({
  agency, onBack, onChange, onToast,
}: {
  agency: Agency;
  onBack: () => void;
  onChange: (next: Agency) => void;
  onToast: (msg: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("customers");
  const [adjustPool, setAdjustPool] = useState<SeatPool | null>(null);
  const [showActivate, setShowActivate] = useState(false);
  const [substituteFor, setSubstituteFor] = useState<AgencyClient | null>(null);
  const [deactivateFor, setDeactivateFor] = useState<AgencyClient | null>(null);
  const [workspaceFor, setWorkspaceFor] = useState<AgencyClient | null>(null);
  const [showInviteStaff, setShowInviteStaff] = useState(false);

  const poolById = (id: string) => agency.pools.find((p) => p.id === id)!;

  const { adjustSeats, activate, deactivate, restore, substitute, inviteStaff, logWorkspaceOpen } =
    agencyActions(agency, onChange, onToast, ADMIN_EMAIL);

  const openWorkspace = (client: AgencyClient) => {
    logWorkspaceOpen(client, agency.owner.email);
    setWorkspaceFor(client);
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "customers", label: "Customers", icon: Users, count: agency.clients.filter((c) => c.status !== "archived").length },
    { id: "seats", label: "Seats & ledger", icon: Layers, count: agency.ledger.length },
    { id: "usage", label: "Usage", icon: Gauge },
    { id: "staff", label: "Staff", icon: ShieldCheck, count: agency.staff.length },
    { id: "activity", label: "Activity", icon: ScrollText, count: agency.activity.length },
  ];

  return (
    <div>
      {/* Header */}
      <button onClick={onBack} className="mb-5 flex items-center gap-2 text-sm text-white/50 transition hover:text-white">
        <ArrowLeft size={16} /> All agencies
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/30 to-indigo-500/30 text-lg font-bold text-sky-300">
            {agency.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{agency.name}</h1>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize ${agencyStatusBadge(agency.status)}`}>{agency.status}</span>
            </div>
            <p className="text-sm text-white/50">
              Owner {agency.owner.name} · {agency.owner.email} · {agency.country} · since {formatDate(agency.createdOn)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setAdjustPool(agency.pools[0])}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0F172A] px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/5"
          >
            <Layers size={15} className="text-sky-400" /> Adjust seats
          </button>
          <button
            onClick={() => setShowActivate(true)}
            disabled={agency.status === "suspended"}
            className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <UserPlus size={15} /> Activate customer
          </button>
        </div>
      </div>

      {agency.status !== "active" && (
        <div className={`mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm ${agency.status === "grace" ? "border-amber-500/20 bg-amber-500/10 text-amber-200" : "border-red-500/20 bg-red-500/10 text-red-200"}`}>
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          {agency.status === "grace"
            ? "Payment failed on 5 Oct 2026. The agency is in its grace period; customers keep access until 19 Oct 2026, then the agency is suspended. Nothing is deleted."
            : "Suspended since 7 Oct 2026 after the grace period ended. Customers cannot open their agents until the agency pays. No data has been deleted."}
        </div>
      )}

      {/* Seat pools */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {agency.pools.map((pool) => {
          const used = seatsInUse(agency, pool.id);
          const left = daysUntil(pool.validUntil);
          return (
            <div key={pool.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/35">Seat pool</p>
                  <p className="font-semibold">{pool.membership}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {pool.agents.map((a) => (
                      <span key={a} className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">{a}</span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setAdjustPool(pool)}
                  className="rounded-lg bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-400 transition hover:bg-sky-500/20"
                >
                  Adjust
                </button>
              </div>
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-sm text-white/60">
                  <span className="text-2xl font-bold text-white">{used}</span> of {pool.seats} seats in use
                </p>
                <p className={`text-xs ${used >= pool.seats ? "text-amber-400" : "text-white/40"}`}>
                  {used >= pool.seats ? "Pool full" : `${pool.seats - used} free`}
                </p>
              </div>
              <SeatBar used={used} total={pool.seats} />
              <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-white/35">Valid</p>
                  <p className="text-white/80">{formatDate(pool.validFrom)} – {formatDate(pool.validUntil)}</p>
                </div>
                <div>
                  <p className="text-white/35">Days left</p>
                  <p className={left < 0 ? "text-red-400" : left <= 30 ? "text-amber-400" : "text-white/80"}>
                    {left < 0 ? `Expired ${-left}d ago` : `${left} days`}
                  </p>
                </div>
                <div>
                  <p className="text-white/35">Tokens / seat / 30d</p>
                  <p className="font-mono text-sky-300">{formatTokens(pool.monthlyTokenLimit)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-white/10">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition ${
                active ? "border-sky-400 text-sky-300" : "border-transparent text-white/50 hover:text-white"
              }`}
            >
              <Icon size={15} />
              {t.label}
              {t.count !== undefined && (
                <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-sky-500/20 text-sky-300" : "bg-white/10 text-white/40"}`}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "customers" && (
        <CustomersTab
          agency={agency}
          poolById={poolById}
          onOpen={openWorkspace}
          onSubstitute={setSubstituteFor}
          onDeactivate={setDeactivateFor}
          onRestore={restore}
        />
      )}
      {tab === "seats" && <LedgerTab agency={agency} poolById={poolById} />}
      {tab === "usage" && <UsageTab agency={agency} poolById={poolById} />}
      {tab === "staff" && <StaffTab agency={agency} onInvite={() => setShowInviteStaff(true)} />}
      {tab === "activity" && <ActivityTab entries={agency.activity} />}

      {/* Modals */}
      {adjustPool && (
        <AdjustSeatsModal
          agency={agency}
          initialPool={adjustPool}
          onClose={() => setAdjustPool(null)}
          onSave={(pool, change, reason, note) => { adjustSeats(pool, change, reason, note); setAdjustPool(null); }}
        />
      )}
      {showActivate && (
        <ActivateModal
          agency={agency}
          onClose={() => setShowActivate(false)}
          onSave={(company, email, poolId, invite) => { activate(company, email, poolId, invite); setShowActivate(false); }}
        />
      )}
      {substituteFor && (
        <SubstituteModal
          client={substituteFor}
          pool={poolById(substituteFor.poolId)}
          onClose={() => setSubstituteFor(null)}
          onSave={(company, email, override) => { substitute(substituteFor, company, email, override); setSubstituteFor(null); }}
        />
      )}
      {deactivateFor && (
        <Modal title={`Deactivate ${deactivateFor.company}?`} subtitle="The seat is freed straight away." onClose={() => setDeactivateFor(null)}>
          <div className="space-y-3 text-sm text-white/60">
            <p>The account is frozen, not deleted. Conversations and the knowledge base stay exportable for <span className="text-white">60 days</span>, then they are purged.</p>
            <p>The agency can restore it within that period if a seat is free.</p>
          </div>
          <div className="mt-6 flex gap-3">
            <button onClick={() => setDeactivateFor(null)} className={secondaryBtn}>Cancel</button>
            <button
              onClick={() => { deactivate(deactivateFor); setDeactivateFor(null); }}
              className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500"
            >
              Deactivate
            </button>
          </div>
        </Modal>
      )}
      {showInviteStaff && (
        <InviteStaffModal
          onClose={() => setShowInviteStaff(false)}
          onSave={(name, email, role) => { inviteStaff(name, email, role); setShowInviteStaff(false); }}
        />
      )}
      {workspaceFor && (
        <WorkspacePreview agency={agency} client={workspaceFor} pool={poolById(workspaceFor.poolId)} onExit={() => setWorkspaceFor(null)} />
      )}
    </div>
  );
}

/* ──────────────── TABS ──────────────── */

export function CustomersTab({
  agency, poolById, onOpen, onSubstitute, onDeactivate, onRestore, canManage = true, canOpen = true,
}: {
  agency: Agency;
  poolById: (id: string) => SeatPool;
  onOpen: (c: AgencyClient) => void;
  onSubstitute: (c: AgencyClient) => void;
  onDeactivate: (c: AgencyClient) => void;
  onRestore: (c: AgencyClient) => void;
  /** Activate, substitute, deactivate and restore. */
  canManage?: boolean;
  canOpen?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const suspended = agency.status === "suspended";

  const rows = agency.clients.filter(
    (c) =>
      (showArchived || c.status !== "archived") &&
      (c.company + c.email).toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers..."
            className="w-full rounded-xl border border-white/10 bg-[#0F172A] py-2.5 pl-9 pr-4 text-sm text-white placeholder-white/40 transition focus:border-sky-500 focus:outline-none"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-white/50">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="rounded border-white/20 bg-transparent" />
          Show archived
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0F172A]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-white/70">
            <thead className="border-b border-white/10 bg-white/5 text-[10px] uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-4 py-4 font-semibold">Customer</th>
                <th className="px-4 py-4 font-semibold">Seat pool</th>
                <th className="px-4 py-4 font-semibold">Status</th>
                <th className="px-4 py-4 font-semibold">Tokens this cycle</th>
                <th className="px-4 py-4 font-semibold">Last active</th>
                <th className="px-4 py-4 font-semibold">Swap</th>
                <th className="px-4 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const pool = poolById(c.poolId);
                const pct = Math.min(100, (c.tokensUsed / pool.monthlyTokenLimit) * 100);
                const archived = c.status === "archived";
                return (
                  <tr key={c.id} className={`group border-b border-white/5 transition hover:bg-white/[0.03] ${archived ? "opacity-60" : ""}`}>
                    <td className="px-4 py-4">
                      <p className="font-medium text-white">{c.company}</p>
                      <p className="text-xs text-white/40">{c.email}</p>
                    </td>
                    <td className="px-4 py-4 text-xs">{pool.membership}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize ${clientStatusBadge(c.status)}`}>{c.status}</span>
                      {archived && c.archivedOn && <p className="mt-1 text-[10px] text-white/30">purge {formatDate(addDays(c.archivedOn, 60))}</p>}
                    </td>
                    <td className="w-48 px-4 py-4">
                      <div className="mb-1 flex justify-between font-mono text-xs">
                        <span className={pct >= 100 ? "text-red-400" : pct >= 80 ? "text-amber-400" : "text-sky-300"}>{formatTokens(c.tokensUsed)}</span>
                        <span className="text-white/30">/ {formatTokens(pool.monthlyTokenLimit)}</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-white/10">
                        <div className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : "bg-sky-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs">{c.lastActive ? formatDate(c.lastActive) : <span className="text-amber-400/80">Never logged in</span>}</td>
                    <td className="px-4 py-4 text-xs">
                      {c.swappedThisCycle ? <span className="text-white/40">Used this cycle</span> : <span className="text-emerald-400/80">Available</span>}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-1.5">
                        {archived ? (
                          canManage && <IconBtn label="Restore" icon={RotateCcw} onClick={() => onRestore(c)} />
                        ) : (
                          <>
                            {canOpen && <IconBtn label="Open workspace" icon={ExternalLink} tone="sky" onClick={() => onOpen(c)} disabled={suspended} />}
                            {canManage && <IconBtn label="Substitute" icon={ArrowLeftRight} onClick={() => onSubstitute(c)} disabled={suspended} />}
                            {canManage && <IconBtn label="Deactivate" icon={Power} tone="red" onClick={() => onDeactivate(c)} />}
                          </>
                        )}
                        {!canOpen && !canManage && <span className="text-[11px] text-white/30">View only</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-white/40">No customers match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  label, icon: Icon, onClick, tone = "plain", disabled,
}: {
  label: string; icon: React.ElementType; onClick: () => void; tone?: "plain" | "sky" | "red"; disabled?: boolean;
}) {
  const tones = {
    plain: "text-white/60 hover:bg-white/10 hover:text-white",
    sky: "text-sky-400 bg-sky-500/10 hover:bg-sky-500/20",
    red: "text-red-400 hover:bg-red-500/10",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-30 ${tones[tone]}`}
    >
      <Icon size={13} />
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}

export function LedgerTab({ agency, poolById }: { agency: Agency; poolById: (id: string) => SeatPool }) {
  // Running total per pool, oldest first, then shown newest first.
  const rows = useMemo(() => {
    const totals: Record<string, number> = {};
    return [...agency.ledger]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((l) => {
        totals[l.poolId] = (totals[l.poolId] ?? 0) + l.change;
        return { ...l, total: totals[l.poolId] };
      })
      .reverse();
  }, [agency.ledger]);

  return (
    <div>
      <p className="mb-4 max-w-3xl text-sm text-white/50">
        A pool&apos;s size is the sum of this ledger. Every grant or reduction is a line with who made it and a note, such as the invoice number. A reduction below the seats in use is refused.
      </p>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0F172A]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-white/70">
            <thead className="border-b border-white/10 bg-white/5 text-[10px] uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-4 py-4 font-semibold">Date</th>
                <th className="px-4 py-4 font-semibold">Pool</th>
                <th className="px-4 py-4 font-semibold">Reason</th>
                <th className="px-4 py-4 font-semibold">By</th>
                <th className="px-4 py-4 font-semibold">Note</th>
                <th className="px-4 py-4 text-right font-semibold">Change</th>
                <th className="px-4 py-4 text-right font-semibold">Seats after</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-b border-white/5">
                  <td className="px-4 py-4 text-xs">{formatDate(l.date)}</td>
                  <td className="px-4 py-4 text-xs">{poolById(l.poolId).membership}</td>
                  <td className="px-4 py-4 text-white">{l.reason}</td>
                  <td className="px-4 py-4 text-xs">{l.by}</td>
                  <td className="px-4 py-4 font-mono text-xs text-white/50">{l.note ?? "—"}</td>
                  <td className={`px-4 py-4 text-right font-mono font-semibold ${l.change > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {l.change > 0 ? "+" : ""}{l.change}
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-white">{l.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function UsageTab({ agency, poolById }: { agency: Agency; poolById: (id: string) => SeatPool }) {
  const live = agency.clients.filter((c) => c.status !== "archived");
  const pctOf = (c: AgencyClient) => (c.tokensUsed / poolById(c.poolId).monthlyTokenLimit) * 100;
  const blocked = live.filter((c) => pctOf(c) >= 100).length;
  const near = live.filter((c) => pctOf(c) >= 80 && pctOf(c) < 100).length;
  const never = live.filter((c) => !c.lastActive).length;
  const expiring = agency.pools.filter((p) => { const d = daysUntil(p.validUntil); return d >= 0 && d <= 30; })
    .reduce((s, p) => s + seatsInUse(agency, p.id), 0);
  const sorted = [...live].sort((a, b) => pctOf(b) - pctOf(a));

  const tiles = [
    { label: "Blocked (100%)", value: blocked, icon: AlertTriangle, tone: "bg-red-500/15 text-red-400" },
    { label: "Near limit (80%+)", value: near, icon: Gauge, tone: "bg-amber-500/15 text-amber-400" },
    { label: "Never logged in", value: never, icon: Mail, tone: "bg-sky-500/15 text-sky-400" },
    { label: "Seats expiring ≤ 30d", value: expiring, icon: CalendarClock, tone: "bg-indigo-500/15 text-indigo-400" },
  ];

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.label} className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${t.tone}`}><Icon size={18} /></div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/35">{t.label}</p>
                <p className="text-xl font-bold">{t.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold">Tokens used this cycle, per customer</p>
          <div className="flex items-center gap-4 text-[10px] text-white/40">
            <span className="flex items-center gap-1.5"><span className="h-3 w-px bg-amber-400" />80% alert</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-px bg-red-500" />100% stop</span>
          </div>
        </div>
        <div className="space-y-3">
          {sorted.map((c) => {
            const pct = pctOf(c);
            return (
              <div key={c.id} className="grid grid-cols-[minmax(0,180px)_1fr_80px] items-center gap-4">
                <p className="truncate text-sm text-white/80">{c.company}</p>
                <div className="relative h-5 rounded bg-white/5">
                  <div
                    className={`h-full rounded ${pct >= 100 ? "bg-red-500/70" : pct >= 80 ? "bg-amber-400/70" : "bg-sky-500/60"}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                  <span className="absolute inset-y-0 w-px bg-amber-400" style={{ left: "80%" }} />
                  <span className="absolute inset-y-0 right-0 w-px bg-red-500" />
                </div>
                <p className="text-right font-mono text-xs text-white/60">{Math.round(pct)}%</p>
              </div>
            );
          })}
          {sorted.length === 0 && <p className="py-6 text-center text-sm text-white/40">No active customers.</p>}
        </div>
      </div>
    </div>
  );
}

export function StaffTab({ agency, onInvite, canInvite = true }: { agency: Agency; onInvite: () => void; canInvite?: boolean }) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/50">People at {agency.name} who can sign in to the agency portal.</p>
        {canInvite && (
          <button onClick={onInvite} className="flex items-center gap-2 rounded-lg bg-sky-500/10 px-3 py-1.5 text-sm text-sky-400 transition hover:bg-sky-500/20">
            <Plus size={14} /> Invite staff
          </button>
        )}
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0F172A]">
        <table className="w-full text-left text-sm text-white/70">
          <thead className="border-b border-white/10 bg-white/5 text-[10px] uppercase tracking-wider text-white/40">
            <tr>
              <th className="px-4 py-4 font-semibold">Name</th>
              <th className="px-4 py-4 font-semibold">Email</th>
              <th className="px-4 py-4 font-semibold">Role</th>
              <th className="px-4 py-4 font-semibold">Can do</th>
            </tr>
          </thead>
          <tbody>
            {agency.staff.map((s) => (
              <tr key={s.id} className="border-b border-white/5">
                <td className="px-4 py-4 font-medium text-white">{s.name}</td>
                <td className="px-4 py-4 text-xs">{s.email}</td>
                <td className="px-4 py-4"><span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize ${roleBadge[s.role]}`}>{s.role}</span></td>
                <td className="px-4 py-4 text-xs text-white/50">{roleHint[s.role]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ActivityTab({ entries, showAgency }: { entries: (ActivityEntry & { agency?: string })[]; showAgency?: boolean }) {
  const [query, setQuery] = useState("");
  const rows = entries.filter((e) =>
    [e.actor, e.action, e.target, e.actingAs ?? "", e.agency ?? ""].join(" ").toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div>
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by person, action, customer..."
          className="w-full rounded-xl border border-white/10 bg-[#0F172A] py-2.5 pl-9 pr-4 text-sm text-white placeholder-white/40 transition focus:border-sky-500 focus:outline-none"
        />
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0F172A]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-white/70">
            <thead className="border-b border-white/10 bg-white/5 text-[10px] uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-4 py-4 font-semibold">When</th>
                {showAgency && <th className="px-4 py-4 font-semibold">Agency</th>}
                <th className="px-4 py-4 font-semibold">Who</th>
                <th className="px-4 py-4 font-semibold">Action</th>
                <th className="px-4 py-4 font-semibold">Target</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-white/5">
                  <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs text-white/50">{e.date}</td>
                  {showAgency && <td className="px-4 py-3.5 text-xs">{e.agency}</td>}
                  <td className="px-4 py-3.5 text-xs">
                    <span className={e.actor === "system" ? "text-white/40" : "text-white"}>{e.actor}</span>
                    {e.actingAs && <p className="text-[10px] text-amber-400/80">acting as {e.actingAs}</p>}
                  </td>
                  <td className="px-4 py-3.5 text-white">{e.action}</td>
                  <td className="px-4 py-3.5 text-xs">{e.target}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={showAgency ? 5 : 4} className="px-4 py-12 text-center text-white/40">No activity matches.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ──────────────── MODALS ──────────────── */

const SEAT_REASONS_ADD = ["Prepaid pack granted", "Agency bought more seats", "Correction"];
const SEAT_REASONS_REMOVE = ["Agency reduced licences", "Correction"];

function AdjustSeatsModal({
  agency, initialPool, onClose, onSave,
}: {
  agency: Agency;
  initialPool: SeatPool;
  onClose: () => void;
  onSave: (pool: SeatPool, change: number, reason: string, note: string) => void;
}) {
  const [poolId, setPoolId] = useState(initialPool.id);
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState(SEAT_REASONS_ADD[1]);
  const [note, setNote] = useState("");

  const pool = agency.pools.find((p) => p.id === poolId)!;
  const used = seatsInUse(agency, pool.id);
  const change = direction === "add" ? amount : -amount;
  const after = pool.seats + change;
  const tooLow = after < used;
  const holders = agency.clients.filter((c) => c.poolId === pool.id && c.status !== "archived");

  const setDir = (d: "add" | "remove") => {
    setDirection(d);
    setReason(d === "add" ? SEAT_REASONS_ADD[1] : SEAT_REASONS_REMOVE[0]);
  };

  return (
    <Modal title="Adjust seats" subtitle={`${agency.name} · each change becomes a ledger line`} onClose={onClose}>
      <div className="space-y-4">
        {agency.pools.length > 1 && (
          <div>
            <label className={labelCls}>Seat pool</label>
            <select value={poolId} onChange={(e) => setPoolId(e.target.value)} className={inputCls}>
              {agency.pools.map((p) => <option key={p.id} value={p.id} className="bg-[#0B1221]">{p.membership}</option>)}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/5 p-1">
          {(["add", "remove"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDir(d)}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${
                direction === d ? (d === "add" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300") : "text-white/50 hover:text-white"
              }`}
            >
              {d === "add" ? <Plus size={14} /> : <Minus size={14} />} {d === "add" ? "Add seats" : "Remove seats"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Seats</label>
            <input type="number" min={1} value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
              {(direction === "add" ? SEAT_REASONS_ADD : SEAT_REASONS_REMOVE).map((r) => <option key={r} className="bg-[#0B1221]">{r}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Note (invoice number, ticket…)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="INV-2026-0450" className={inputCls} />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
          <span className="text-white/50">Pool size</span>
          <span className="font-mono">
            {pool.seats} <span className="text-white/30">→</span>{" "}
            <span className={tooLow ? "text-red-400" : "text-white"}>{after}</span>
            <span className="ml-2 text-xs text-white/40">({used} in use)</span>
          </span>
        </div>

        {tooLow && (
          <ErrorBox>
            <p className="mb-1 font-semibold">Refused: {used} seats are in use.</p>
            <p>Deactivate {used - after} of these customers first, or schedule the reduction for the end of the period:</p>
            <p className="mt-1 text-red-200/80">{holders.map((h) => h.company).join(", ")}</p>
          </ErrorBox>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className={secondaryBtn}>Cancel</button>
          <button disabled={tooLow} onClick={() => onSave(pool, change, reason, note)} className={primaryBtn}>
            Record {change > 0 ? "+" : ""}{change}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function ActivateModal({
  agency, onClose, onSave,
}: {
  agency: Agency;
  onClose: () => void;
  onSave: (company: string, email: string, poolId: string, sendInvite: boolean) => void;
}) {
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [poolId, setPoolId] = useState(agency.pools[0].id);
  const [sendInvite, setSendInvite] = useState(true);

  const pool = agency.pools.find((p) => p.id === poolId)!;
  const used = seatsInUse(agency, pool.id);
  const full = used >= pool.seats;
  const valid = company.trim() && /\S+@\S+\.\S+/.test(email);

  return (
    <Modal title="Activate a customer" subtitle="Uses one seat. The account exists at once, so the agency can prepare it." onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Company name</label>
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Rossi Dental Clinic" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Customer email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@rossidental.it" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Seat pool</label>
          <select value={poolId} onChange={(e) => setPoolId(e.target.value)} className={inputCls}>
            {agency.pools.map((p) => (
              <option key={p.id} value={p.id} className="bg-[#0B1221]">
                {p.membership} — {seatsInUse(agency, p.id)}/{p.seats} used
              </option>
            ))}
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-white/60">
          <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} className="rounded border-white/20 bg-transparent" />
          Send the invitation email now
        </label>
        {full ? (
          <ErrorBox>The {pool.membership} pool is full ({used}/{pool.seats}). Add seats or deactivate a customer first.</ErrorBox>
        ) : (
          <InfoBox>The membership runs while the seat is active and ends with the pool on {formatDate(pool.validUntil)}. No separate duration.</InfoBox>
        )}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className={secondaryBtn}>Cancel</button>
          <button disabled={full || !valid} onClick={() => onSave(company.trim(), email.trim(), poolId, sendInvite)} className={primaryBtn}>
            Activate seat
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function SubstituteModal({
  client, pool, onClose, onSave, allowOverride = true,
}: {
  client: AgencyClient;
  pool: SeatPool;
  onClose: () => void;
  onSave: (company: string, email: string, override: boolean) => void;
  /** Only a platform admin may allow a second swap in one cycle. */
  allowOverride?: boolean;
}) {
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [override, setOverride] = useState(false);
  const remaining = Math.max(0, pool.monthlyTokenLimit - client.tokensUsed);
  const cycleEnds = addDays(client.cycleStart, 30);
  const blocked = client.swappedThisCycle && !override;
  const valid = company.trim() && /\S+@\S+\.\S+/.test(email);

  return (
    <Modal title="Substitute customer" subtitle="Deactivates one customer and activates another on the same seat." onClose={onClose} width="max-w-lg">
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
            <p className="text-[10px] uppercase tracking-wider text-red-300/70">Outgoing</p>
            <p className="truncate font-medium">{client.company}</p>
            <p className="truncate text-xs text-white/40">{client.email}</p>
          </div>
          <ArrowLeftRight size={18} className="text-white/30" />
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-[10px] uppercase tracking-wider text-emerald-300/70">Incoming</p>
            <p className="truncate font-medium">{company || "New customer"}</p>
            <p className="truncate text-xs text-white/40">{email || "—"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Incoming company</label>
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Incoming email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.it" className={inputCls} />
          </div>
        </div>

        <InfoBox>
          The token cycle belongs to the seat. The incoming customer gets what is left of it:{" "}
          <span className="font-mono font-semibold text-white">{formatTokens(remaining)}</span> until {formatDate(cycleEnds)}.
          {" "}{client.company}&apos;s conversations and knowledge base do <span className="font-semibold">not</span> move; the account is archived and purged after 60 days.
        </InfoBox>

        {client.swappedThisCycle && (
          <div className="space-y-2">
            <ErrorBox>
              This seat was already swapped this cycle. One swap per seat per cycle.
              {!allowOverride && " Ask the AI Team admin if you need a second swap."}
            </ErrorBox>
            {allowOverride && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-amber-300">
                <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="rounded border-white/20 bg-transparent" />
                Admin override — allow a second swap
              </label>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className={secondaryBtn}>Cancel</button>
          <button disabled={blocked || !valid} onClick={() => onSave(company.trim(), email.trim(), override)} className={primaryBtn}>
            Substitute
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function InviteStaffModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string, email: string, role: StaffRole) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("operator");
  const valid = name.trim() && /\S+@\S+\.\S+/.test(email);
  return (
    <Modal title="Invite staff" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Role</label>
          <div className="grid grid-cols-3 gap-2">
            {(["manager", "operator", "viewer"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`rounded-xl border p-2.5 text-left transition ${role === r ? "border-sky-400/40 bg-sky-500/10" : "border-white/10 hover:bg-white/5"}`}
              >
                <p className="text-sm font-medium capitalize">{r}</p>
                <p className="text-[10px] leading-tight text-white/40">{roleHint[r]}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className={secondaryBtn}>Cancel</button>
          <button disabled={!valid} onClick={() => onSave(name.trim(), email.trim(), role)} className={primaryBtn}>Send invite</button>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────── WORKSPACE SWITCH PREVIEW ──────────────── */

export function WorkspacePreview({
  agency, client, pool, onExit, actorEmail = agency.owner.email,
}: {
  agency: Agency; client: AgencyClient; pool: SeatPool; onExit: () => void; actorEmail?: string;
}) {
  const conversations = [
    { title: "Instagram plan for November", agent: pool.agents[1] ?? pool.agents[0], by: "agency", when: "Today 09:44" },
    { title: "Reply to Google review", agent: pool.agents[0], by: "customer", when: "Yesterday" },
    { title: "Newsletter: autumn promotion", agent: pool.agents[pool.agents.length - 1], by: "agency", when: "9 Oct" },
    { title: "FAQ for the website", agent: pool.agents[0], by: "customer", when: "6 Oct" },
  ];
  const pct = Math.min(100, (client.tokensUsed / pool.monthlyTokenLimit) * 100);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#020617]">
      {/* Agency banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/30 bg-gradient-to-r from-amber-500/20 to-orange-500/10 px-6 py-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-md bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">Agency view</span>
          <span className="text-amber-100">
            You are working in <span className="font-semibold text-white">{client.company}</span>&apos;s account as{" "}
            <span className="font-semibold text-white">{actorEmail}</span> ({agency.name})
          </span>
        </div>
        <button onClick={onExit} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/20">
          <ArrowLeft size={14} /> Back to agency
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl p-8">
          <p className="text-[10px] uppercase tracking-widest text-white/30">Customer workspace · demo</p>
          <h2 className="mb-1 text-2xl font-bold">{client.company}</h2>
          <p className="mb-8 text-sm text-white/50">
            Shared account: the customer signs in with their own login, the agency enters through this switch. Every token comes from this seat.
          </p>

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/35">Seat tokens this cycle</p>
              <p className="mb-2 font-mono text-xl font-bold text-sky-400">{formatTokens(client.tokensUsed)} <span className="text-sm text-white/30">/ {formatTokens(pool.monthlyTokenLimit)}</span></p>
              <SeatBar used={pct} total={100} />
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/35">Membership</p>
              <p className="text-xl font-bold">{pool.membership}</p>
              <p className="text-xs text-white/40">Active until {formatDate(pool.validUntil)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/35">Locked in agency view</p>
              <p className="text-sm text-white/70">Email, password and account deletion</p>
            </div>
          </div>

          <p className="mb-3 text-sm font-semibold">Agents</p>
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {pool.agents.map((a) => (
              <div key={a} className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0F172A] p-4 transition hover:border-sky-400/30">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300"><Bot size={18} /></div>
                <p className="text-sm font-medium">{a}</p>
              </div>
            ))}
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0F172A] p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/20 text-teal-300"><BookOpen size={18} /></div>
              <p className="text-sm font-medium">Knowledge base</p>
            </div>
          </div>

          <p className="mb-3 text-sm font-semibold">Recent conversations</p>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0F172A]">
            {conversations.map((c) => (
              <div key={c.title} className="flex items-center justify-between gap-4 border-b border-white/5 px-5 py-4 last:border-b-0">
                <div className="flex items-center gap-3">
                  <MessageSquare size={16} className="text-white/30" />
                  <div>
                    <p className="text-sm text-white">{c.title}</p>
                    <p className="text-xs text-white/40">{c.agent} · {c.when}</p>
                  </div>
                </div>
                {c.by === "agency" ? (
                  <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">by the agency</span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-white/30"><Activity size={11} /> customer</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
