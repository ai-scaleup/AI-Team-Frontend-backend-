"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowLeftRight, Plus, Minus, X, ExternalLink, UserPlus, Power,
  RotateCcw, AlertTriangle, ShieldCheck, Mail, Search,
  Activity, Users, Layers, Gauge, CalendarClock, Pencil, Archive, Globe, KeyRound,
} from "lucide-react";
import {
  Agency, AgencyClient, AgencyMembership, ActivityEntry, SeatPool, StaffRole,
  daysUntil, formatDate, formatTokens, seatsInUse,
} from "./agencyTypes";
import {
  activateCustomer, addPool, adjustSeats, archiveAgency, deactivateCustomer, inviteStaff,
  restoreCustomer, substituteCustomer, todayIso, updateAgency, updatePoolValidity,
  createLoginLink, setBranding,
} from "./agenciesApi";
import { BrandingForm, LoginLinkModal, SignInAddress } from "./WhiteLabel";

type Tab = "customers" | "seats" | "staff" | "activity" | "whitelabel";

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

/** Runs a modal's save; on failure the modal stays open and shows the error. */
function useSave() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => void | Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

/* ──────────────── MAIN (superadmin, server-backed) ──────────────── */

export default function AgencyDetail({
  agency, memberships, onBack, onChange, onArchived, onToast,
}: {
  agency: Agency;
  /** Live agency memberships, for adding a seat pool. */
  memberships: AgencyMembership[];
  onBack: () => void;
  onChange: (next: Agency) => void;
  onArchived: (agency: Agency) => void;
  onToast: (msg: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("customers");
  const [adjustPool, setAdjustPool] = useState<SeatPool | null>(null);
  const [renewPool, setRenewPool] = useState<SeatPool | null>(null);
  const [showAddPool, setShowAddPool] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showActivate, setShowActivate] = useState(false);
  const [substituteFor, setSubstituteFor] = useState<AgencyClient | null>(null);
  const [deactivateFor, setDeactivateFor] = useState<AgencyClient | null>(null);
  const [showInviteStaff, setShowInviteStaff] = useState(false);
  const [loginLinkFor, setLoginLinkFor] = useState<AgencyClient | null>(null);
  const today = todayIso();

  const poolById = (id: string) => agency.pools.find((p) => p.id === id)!;

  // Every action saves on the server and swaps in the agency it sends back,
  // so seats, ledger and activity always match the database.
  const save = async (request: Promise<Agency>, message: string) => {
    onChange(await request);
    onToast(message);
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "customers", label: "Customers", icon: Users, count: agency.clients.filter((c) => c.status !== "archived").length },
    { id: "seats", label: "Seats & ledger", icon: Layers, count: agency.ledger.length },
    { id: "staff", label: "Staff", icon: ShieldCheck, count: agency.staff.length },
    { id: "activity", label: "Activity", icon: Activity, count: agency.activity.length },
    { id: "whitelabel", label: "White label", icon: Globe },
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
              Owner {agency.owner.name} · {agency.owner.email}{agency.country ? ` · ${agency.country}` : ""} · since {formatDate(agency.createdOn)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0F172A] px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/5"
          >
            <Pencil size={15} className="text-sky-400" /> Edit agency
          </button>
          <button
            onClick={() => setShowAddPool(true)}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0F172A] px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/5"
          >
            <Plus size={15} className="text-sky-400" /> Add seat pool
          </button>
          <button
            onClick={() => setAdjustPool(agency.pools[0])}
            disabled={agency.pools.length === 0}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0F172A] px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/5 disabled:opacity-40"
          >
            <Layers size={15} className="text-sky-400" /> Adjust seats
          </button>
          <button
            onClick={() => setShowActivate(true)}
            disabled={agency.status === "suspended" || agency.pools.length === 0}
            className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <UserPlus size={15} /> Activate customer
          </button>
        </div>
      </div>

      <div className="mb-6">
        <InfoBox>
          Records only for now: customers on a seat are saved here, but they do not get chat access from the seat yet, and the token columns stay at 0 until that is connected.
        </InfoBox>
      </div>

      {agency.status !== "active" && (
        <div className={`mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm ${agency.status === "grace" ? "border-amber-500/20 bg-amber-500/10 text-amber-200" : "border-red-500/20 bg-red-500/10 text-red-200"}`}>
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          {agency.status === "grace"
            ? "The agency is in its grace period. Everything keeps working; set it to Suspended from Edit agency if it does not pay. Nothing is deleted."
            : "Suspended. New customers, substitutions and restores are blocked until the agency is set back to Active. No data has been deleted."}
        </div>
      )}

      {/* Seat pools */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {agency.pools.map((pool) => {
          const used = seatsInUse(agency, pool.id);
          const left = daysUntil(pool.validUntil, today);
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
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setRenewPool(pool)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:bg-white/5 hover:text-white"
                  >
                    Renew
                  </button>
                  <button
                    onClick={() => setAdjustPool(pool)}
                    className="rounded-lg bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-400 transition hover:bg-sky-500/20"
                  >
                    Adjust
                  </button>
                </div>
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
          onOpen={() => {}}
          onSubstitute={setSubstituteFor}
          onDeactivate={setDeactivateFor}
          onRestore={(c) =>
            save(restoreCustomer(agency.id, c.id), `${c.company} restored`).catch((e) =>
              onToast(e instanceof Error ? e.message : "Unable to restore."),
            )
          }
          canOpen={false}
          onLoginLink={setLoginLinkFor}
        />
      )}
      {tab === "seats" && <LedgerTab agency={agency} poolById={poolById} />}
      {tab === "staff" && <StaffTab agency={agency} onInvite={() => setShowInviteStaff(true)} />}
      {tab === "activity" && <ActivityTab entries={agency.activity} />}
      {tab === "whitelabel" && (
        <div className="space-y-8">
          <section>
            <h2 className="mb-1 text-sm font-semibold">Branding</h2>
            <p className="mb-4 text-sm text-white/50">What the agency&apos;s customers see on the agency&apos;s own address instead of AI Team.</p>
            <BrandingForm
              key={agency.id}
              branding={agency.branding}
              fallbackName={agency.name}
              onSave={(input) => save(setBranding(agency.id, input), "Branding saved")}
            />
          </section>
          <section>
            <h2 className="mb-1 text-sm font-semibold">Sign-in address</h2>
            <p className="mb-4 text-sm text-white/50">
              The agency&apos;s customers sign in here with their email and a password (no AI Team login). Give each customer a
              setup link from the Customers tab.
            </p>
            <SignInAddress slug={agency.slug} />
          </section>
        </div>
      )}

      {/* Modals */}
      {adjustPool && (
        <AdjustSeatsModal
          agency={agency}
          initialPool={adjustPool}
          onClose={() => setAdjustPool(null)}
          onSave={async (pool, change, reason, note) => {
            await save(
              adjustSeats(agency.id, pool.id, change, reason, note),
              `${pool.membership}: ${change > 0 ? "+" : ""}${change} seats recorded in the ledger`,
            );
            setAdjustPool(null);
          }}
        />
      )}
      {renewPool && (
        <RenewPoolModal
          pool={renewPool}
          onClose={() => setRenewPool(null)}
          onSave={async (validUntil) => {
            await save(updatePoolValidity(agency.id, renewPool.id, validUntil), `${renewPool.membership} pool now runs until ${formatDate(validUntil)}`);
            setRenewPool(null);
          }}
        />
      )}
      {showAddPool && (
        <AddPoolModal
          memberships={memberships}
          onClose={() => setShowAddPool(false)}
          onSave={async (input) => {
            await save(addPool(agency.id, input), `${input.seats} seats added in a new pool`);
            setShowAddPool(false);
          }}
        />
      )}
      {showEdit && (
        <EditAgencyModal
          agency={agency}
          onClose={() => setShowEdit(false)}
          onSave={async (input) => {
            await save(updateAgency(agency.id, input), `${input.name} saved`);
            setShowEdit(false);
          }}
          onArchive={async () => {
            await archiveAgency(agency.id);
            setShowEdit(false);
            onArchived(agency);
          }}
        />
      )}
      {showActivate && (
        <ActivateModal
          agency={agency}
          onClose={() => setShowActivate(false)}
          onSave={async (company, email, poolId, invite) => {
            await save(activateCustomer(agency.id, { company, email, poolId, invite }), `${company} now holds a seat`);
            setShowActivate(false);
          }}
        />
      )}
      {substituteFor && (
        <SubstituteModal
          client={substituteFor}
          pool={poolById(substituteFor.poolId)}
          onClose={() => setSubstituteFor(null)}
          onSave={async (company, email, override) => {
            await save(
              substituteCustomer(agency.id, substituteFor.id, { company, email, override }),
              `Seat moved from ${substituteFor.company} to ${company}`,
            );
            setSubstituteFor(null);
          }}
        />
      )}
      {loginLinkFor && (
        <LoginLinkModal
          customer={loginLinkFor}
          slug={agency.slug}
          onCreate={() => createLoginLink(agency.id, loginLinkFor.id)}
          onClose={() => setLoginLinkFor(null)}
        />
      )}
      {deactivateFor && (
        <DeactivateModal
          client={deactivateFor}
          onClose={() => setDeactivateFor(null)}
          onConfirm={async () => {
            await save(deactivateCustomer(agency.id, deactivateFor.id), `${deactivateFor.company} archived — seat freed`);
            setDeactivateFor(null);
          }}
        />
      )}
      {showInviteStaff && (
        <InviteStaffModal
          onClose={() => setShowInviteStaff(false)}
          onSave={async (name, email, role) => {
            await save(inviteStaff(agency.id, { name, email, role }), `${name} added as ${role}`);
            setShowInviteStaff(false);
          }}
        />
      )}
    </div>
  );
}

/* ──────────────── TABS ──────────────── */

export function CustomersTab({
  agency, poolById, onOpen, onSubstitute, onDeactivate, onRestore, canManage = true, canOpen = true, onLoginLink,
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
  /** Setup link for the agency's own address; absent = no button. */
  onLoginLink?: (c: AgencyClient) => void;
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
                      {archived && c.archivedOn && <p className="mt-1 text-[10px] text-white/30">archived {formatDate(c.archivedOn)}</p>}
                      {!archived && c.hasLogin && <p className="mt-1 text-[10px] text-emerald-400/70">password set</p>}
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
                            {onLoginLink && <IconBtn label="Login link" icon={KeyRound} onClick={() => onLoginLink(c)} />}
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
  const expiring = agency.pools.filter((p) => { const d = daysUntil(p.validUntil, todayIso()); return d >= 0 && d <= 30; })
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
  onSave: (pool: SeatPool, change: number, reason: string, note: string) => void | Promise<void>;
}) {
  const { busy, error, run } = useSave();
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

        {error && <ErrorBox>{error}</ErrorBox>}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className={secondaryBtn}>Cancel</button>
          <button disabled={tooLow || busy} onClick={() => run(() => onSave(pool, change, reason, note.trim()))} className={primaryBtn}>
            {busy ? "Saving…" : `Record ${change > 0 ? "+" : ""}${change}`}
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
  onSave: (company: string, email: string, poolId: string, sendInvite: boolean) => void | Promise<void>;
}) {
  const { busy, error, run } = useSave();
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
          Mark as invited (not signed in yet — no email is sent)
        </label>
        {full ? (
          <ErrorBox>The {pool.membership} pool is full ({used}/{pool.seats}). Add seats or deactivate a customer first.</ErrorBox>
        ) : (
          <InfoBox>The membership runs while the seat is active and ends with the pool on {formatDate(pool.validUntil)}. No separate duration.</InfoBox>
        )}
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className={secondaryBtn}>Cancel</button>
          <button disabled={full || !valid || busy} onClick={() => run(() => onSave(company.trim(), email.trim(), poolId, sendInvite))} className={primaryBtn}>
            {busy ? "Saving…" : "Activate seat"}
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
  onSave: (company: string, email: string, override: boolean) => void | Promise<void>;
  /** Only a platform admin may allow a second swap in one cycle. */
  allowOverride?: boolean;
}) {
  const { busy, error, run } = useSave();
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
          {" "}{client.company}&apos;s conversations and knowledge base do <span className="font-semibold">not</span> move; {client.company} is archived, not deleted.
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

        {error && <ErrorBox>{error}</ErrorBox>}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className={secondaryBtn}>Cancel</button>
          <button disabled={blocked || !valid || busy} onClick={() => run(() => onSave(company.trim(), email.trim(), override))} className={primaryBtn}>
            {busy ? "Saving…" : "Substitute"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function InviteStaffModal({
  onClose, onSave,
}: {
  onClose: () => void;
  onSave: (name: string, email: string, role: StaffRole) => void | Promise<void>;
}) {
  const { busy, error, run } = useSave();
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
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className={secondaryBtn}>Cancel</button>
          <button disabled={!valid || busy} onClick={() => run(() => onSave(name.trim(), email.trim(), role))} className={primaryBtn}>
            {busy ? "Saving…" : "Add staff"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────── SUPERADMIN-ONLY MODALS ──────────────── */

function DeactivateModal({
  client, onClose, onConfirm,
}: {
  client: AgencyClient;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { busy, error, run } = useSave();
  return (
    <Modal title={`Deactivate ${client.company}?`} subtitle="The seat is freed straight away." onClose={onClose}>
      <div className="space-y-3 text-sm text-white/60">
        <p>The customer is archived, <span className="text-white">not deleted</span>.</p>
        <p>It can be restored later from &quot;Show archived&quot; if a seat in its pool is free.</p>
      </div>
      {error && <div className="mt-4"><ErrorBox>{error}</ErrorBox></div>}
      <div className="mt-6 flex gap-3">
        <button onClick={onClose} className={secondaryBtn}>Cancel</button>
        <button
          onClick={() => run(onConfirm)}
          disabled={busy}
          className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-40"
        >
          {busy ? "Deactivating…" : "Deactivate"}
        </button>
      </div>
    </Modal>
  );
}

function RenewPoolModal({
  pool, onClose, onSave,
}: {
  pool: SeatPool;
  onClose: () => void;
  onSave: (validUntil: string) => Promise<void>;
}) {
  const { busy, error, run } = useSave();
  const [validUntil, setValidUntil] = useState(pool.validUntil);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(validUntil) && validUntil >= pool.validFrom && validUntil !== pool.validUntil;
  return (
    <Modal title={`Renew ${pool.membership} pool`} subtitle={`Valid from ${formatDate(pool.validFrom)}. Seats and customers stay as they are.`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Valid until (inclusive)</label>
          <input type="date" value={validUntil} min={pool.validFrom} onChange={(e) => setValidUntil(e.target.value)} className={inputCls} />
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className={secondaryBtn}>Cancel</button>
          <button disabled={!valid || busy} onClick={() => run(() => onSave(validUntil))} className={primaryBtn}>
            {busy ? "Saving…" : "Save date"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const oneYearFromToday = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function AddPoolModal({
  memberships, onClose, onSave,
}: {
  memberships: AgencyMembership[];
  onClose: () => void;
  onSave: (input: { agencyMembershipId: string; seats: number; validUntil: string; note: string }) => Promise<void>;
}) {
  const { busy, error, run } = useSave();
  const [membershipId, setMembershipId] = useState(memberships[0]?.id ?? "");
  const [seats, setSeats] = useState(5);
  const [validUntil, setValidUntil] = useState(oneYearFromToday);
  const [note, setNote] = useState("");
  const tpl = memberships.find((m) => m.id === membershipId) ?? memberships[0];
  const valid = tpl && seats > 0 && /^\d{4}-\d{2}-\d{2}$/.test(validUntil);
  return (
    <Modal title="Add seat pool" subtitle="A new block of seats on an agency membership. Starts today." onClose={onClose}>
      <div className="space-y-4">
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
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Seats</label>
            <input type="number" min={1} value={seats} onChange={(e) => setSeats(Math.max(1, Number(e.target.value) || 1))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Valid until</label>
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Note (invoice number)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="INV-2026-0450" className={inputCls} />
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className={secondaryBtn}>Cancel</button>
          <button
            disabled={!valid || busy}
            onClick={() => run(() => onSave({ agencyMembershipId: tpl!.id, seats, validUntil, note: note.trim() }))}
            className={primaryBtn}
          >
            {busy ? "Saving…" : "Add pool"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditAgencyModal({
  agency, onClose, onSave, onArchive,
}: {
  agency: Agency;
  onClose: () => void;
  onSave: (input: { name: string; ownerName: string; ownerEmail: string; country: string; status: Agency["status"] }) => Promise<void>;
  onArchive: () => Promise<void>;
}) {
  const { busy, error, run } = useSave();
  const [name, setName] = useState(agency.name);
  const [ownerName, setOwnerName] = useState(agency.owner.name);
  const [ownerEmail, setOwnerEmail] = useState(agency.owner.email);
  const [country, setCountry] = useState(agency.country);
  const [status, setStatus] = useState<Agency["status"]>(agency.status);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const liveCustomers = agency.clients.filter((c) => c.status !== "archived").length;
  const valid = name.trim() && ownerName.trim() && /\S+@\S+\.\S+/.test(ownerEmail);
  const statuses: { id: Agency["status"]; hint: string }[] = [
    { id: "active", hint: "Everything works" },
    { id: "grace", hint: "Payment late, still works" },
    { id: "suspended", hint: "No new customers or swaps" },
  ];
  return (
    <Modal title="Edit agency" onClose={onClose} width="max-w-lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Agency name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Country</label>
            <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Italy" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Owner name</label>
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Owner email</label>
            <input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <div className="grid grid-cols-3 gap-2">
            {statuses.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatus(s.id)}
                className={`rounded-xl border p-2.5 text-left transition ${status === s.id ? "border-sky-400/40 bg-sky-500/10" : "border-white/10 hover:bg-white/5"}`}
              >
                <p className="text-sm font-medium capitalize">{s.id}</p>
                <p className="text-[10px] leading-tight text-white/40">{s.hint}</p>
              </button>
            ))}
          </div>
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className={secondaryBtn}>Cancel</button>
          <button
            disabled={!valid || busy}
            onClick={() => run(() => onSave({ name: name.trim(), ownerName: ownerName.trim(), ownerEmail: ownerEmail.trim(), country: country.trim(), status }))}
            className={primaryBtn}
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>

        <div className="border-t border-white/10 pt-4">
          {confirmArchive ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-white/60">Archive {agency.name}? It is hidden, nothing is deleted.</span>
              <div className="flex gap-2">
                <button onClick={() => setConfirmArchive(false)} className="rounded-lg px-2 py-1 text-white/50 transition hover:bg-white/5">No</button>
                <button
                  onClick={() => run(onArchive)}
                  disabled={busy}
                  className="rounded-lg bg-red-500/15 px-2 py-1 font-medium text-red-300 transition hover:bg-red-500/25 disabled:opacity-50"
                >
                  Archive
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmArchive(true)}
              disabled={liveCustomers > 0}
              title={liveCustomers > 0 ? "Deactivate every customer first" : undefined}
              className="flex items-center gap-2 text-xs text-white/40 transition hover:text-red-400 disabled:cursor-not-allowed disabled:hover:text-white/40"
            >
              <Archive size={13} /> Archive agency{liveCustomers > 0 ? ` (deactivate ${liveCustomers} customer${liveCustomers === 1 ? "" : "s"} first)` : ""}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
