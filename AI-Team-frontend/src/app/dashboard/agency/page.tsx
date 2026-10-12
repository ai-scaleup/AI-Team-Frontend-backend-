"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard, Users, Layers, Gauge, ShieldCheck, ScrollText, CreditCard,
  ArrowLeft, UserPlus, ExternalLink, AlertTriangle, Mail, CalendarClock,
  CheckCircle2, Sparkles, ChevronDown, Send, Lock, Receipt, Download, Building2,
} from "lucide-react";
import {
  ActivateModal, ActivityTab, CustomersTab, InfoBox, InviteStaffModal, LedgerTab,
  Modal, SeatBar, StaffTab, SubstituteModal, UsageTab, WorkspacePreview,
  agencyActions, inputCls, labelCls, primaryBtn, roleBadge, roleHint, secondaryBtn,
} from "../admin/agencies/AgencyDetail";
import {
  Agency, AgencyClient, INITIAL_AGENCIES, SeatPool, StaffMember, StaffRole,
  daysUntil, formatDate, formatTokens, seatsInUse,
} from "../admin/agencies/mockData";

/* ──────────────── DEMO SETUP ──────────────── */

// The portal demo is signed in as Studio Zeta Digital ("Agency Z" in the plan).
const DEMO_AGENCY_ID = "ag-zeta";

type Section = "overview" | "customers" | "seats" | "usage" | "team" | "activity" | "billing";

const NAV: { id: Section; label: string; icon: React.ElementType; roles: StaffRole[] }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, roles: ["owner", "manager", "operator", "viewer"] },
  { id: "customers", label: "Customers", icon: Users, roles: ["owner", "manager", "operator", "viewer"] },
  { id: "seats", label: "Seats", icon: Layers, roles: ["owner", "manager"] },
  { id: "usage", label: "Usage", icon: Gauge, roles: ["owner", "manager", "viewer"] },
  { id: "team", label: "Team", icon: ShieldCheck, roles: ["owner", "manager"] },
  { id: "activity", label: "Activity", icon: ScrollText, roles: ["owner", "manager", "viewer"] },
  { id: "billing", label: "Billing", icon: CreditCard, roles: ["owner"] },
];

// Sample prices for the billing preview (phase 3).
const PRICE_PER_SEAT_EUR: Record<string, number> = {
  "Agency Pro": 39,
  "Agency Starter": 19,
  "Agency Enterprise": 89,
};

/* ──────────────── PAGE ──────────────── */

export default function AgencyPortalPage() {
  const [agency, setAgency] = useState<Agency>(INITIAL_AGENCIES.find((a) => a.id === DEMO_AGENCY_ID)!);
  const [me, setMe] = useState<StaffMember>(agency.staff[0]);
  const [section, setSection] = useState<Section>("overview");
  const [toast, setToast] = useState<string | null>(null);

  const [showActivate, setShowActivate] = useState(false);
  const [substituteFor, setSubstituteFor] = useState<AgencyClient | null>(null);
  const [deactivateFor, setDeactivateFor] = useState<AgencyClient | null>(null);
  const [workspaceFor, setWorkspaceFor] = useState<AgencyClient | null>(null);
  const [showInviteStaff, setShowInviteStaff] = useState(false);
  const [showRequestSeats, setShowRequestSeats] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const can = {
    manage: me.role === "owner" || me.role === "manager",
    open: me.role !== "viewer",
    team: me.role === "owner",
  };

  const poolById = (id: string) => agency.pools.find((p) => p.id === id)!;
  const actions = agencyActions(agency, setAgency, setToast, me.email);

  const switchRole = (member: StaffMember) => {
    setMe(member);
    const allowed = NAV.find((n) => n.id === section)?.roles.includes(member.role);
    if (!allowed) setSection("overview");
  };

  const openWorkspace = (client: AgencyClient) => {
    actions.logWorkspaceOpen(client, me.email);
    setWorkspaceFor(client);
  };

  const requestSeats = (pool: SeatPool, seats: number, message: string) => {
    setAgency({
      ...agency,
      activity: [
        {
          id: Math.random().toString(36).slice(2, 9),
          date: `2026-10-12 ${new Date().toTimeString().slice(0, 5)}`,
          actor: me.email,
          action: `Requested +${seats} seats`,
          target: `${pool.membership} pool${message ? ` — “${message}”` : ""}`,
        },
        ...agency.activity,
      ],
    });
    setToast(`Request for +${seats} ${pool.membership} seats sent to AI Team`);
  };

  const nav = NAV.filter((n) => n.roles.includes(me.role));
  const live = agency.clients.filter((c) => c.status !== "archived");

  return (
    <div className="flex h-screen overflow-hidden bg-[#020617] text-white">
      {/* Sidebar */}
      <aside className="hidden h-screen w-64 flex-shrink-0 flex-col border-r border-white/10 bg-[#0B1221] md:flex">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500/30 to-indigo-500/30 text-xs font-bold text-sky-300">SZ</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{agency.name}</p>
            <p className="text-[10px] uppercase tracking-wider text-white/35">Agency portal</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1.5 p-4">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "border-sky-400/30 bg-gradient-to-r from-sky-500/20 to-indigo-500/10 text-sky-300 shadow-[inset_3px_0_0_#38bdf8]"
                    : "border-transparent text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={17} />
                {item.label}
                {item.id === "billing" && <span className="ml-auto rounded bg-white/10 px-1.5 text-[9px] uppercase text-white/40">Soon</span>}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto p-4">
          <Link href="/dashboard" className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/5 hover:text-white">
            <ArrowLeft size={17} /> My dashboard
          </Link>
        </div>
      </aside>

      <main className="h-screen min-w-0 flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-30 border-b border-white/10 bg-[#020617]/90 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-8">
            <div className="flex items-center gap-2 text-xs text-indigo-200">
              <Sparkles size={14} className="flex-shrink-0 text-indigo-300" />
              <span className="hidden sm:inline">Design demo · sample data · nothing is saved</span>
              <span className="sm:hidden">Demo</span>
            </div>
            <RoleSwitcher staff={agency.staff} me={me} onChange={switchRole} />
          </div>
          {/* Mobile nav */}
          <div className="flex gap-1 overflow-x-auto px-4 pb-3 md:hidden">
            {nav.map((item) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
                  section === item.id ? "bg-sky-500/20 text-sky-300" : "text-white/50"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-[1400px] p-4 md:p-8">
          {section === "overview" && (
            <Overview
              agency={agency}
              me={me}
              can={can}
              poolById={poolById}
              onAdd={() => setShowActivate(true)}
              onOpen={openWorkspace}
              onGo={setSection}
              onResend={(c) => setToast(`Invitation sent again to ${c.email}`)}
            />
          )}

          {section === "customers" && (
            <>
              <PageHead
                title="Customers"
                subtitle={`${live.length} customers on ${agency.pools.reduce((s, p) => s + p.seats, 0)} seats`}
                action={can.manage && (
                  <button onClick={() => setShowActivate(true)} className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-500">
                    <UserPlus size={15} /> Add customer
                  </button>
                )}
              />
              {me.role === "operator" && <RoleNote>As an operator you can open customer workspaces. Seats and customers are managed by the owner or a manager.</RoleNote>}
              {me.role === "viewer" && <RoleNote>As a viewer you can see customers and reports, but not change them or open workspaces.</RoleNote>}
              <CustomersTab
                agency={agency}
                poolById={poolById}
                onOpen={openWorkspace}
                onSubstitute={setSubstituteFor}
                onDeactivate={setDeactivateFor}
                onRestore={actions.restore}
                canManage={can.manage}
                canOpen={can.open}
              />
            </>
          )}

          {section === "seats" && (
            <>
              <PageHead
                title="Seats"
                subtitle="Each seat keeps one customer active. Seats are bought from AI Team."
                action={
                  <button onClick={() => setShowRequestSeats(true)} className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-500">
                    <Send size={15} /> Request more seats
                  </button>
                }
              />
              <PoolCards agency={agency} />
              <h2 className="mb-3 mt-8 text-sm font-semibold">Seat history</h2>
              <LedgerTab agency={agency} poolById={poolById} />
            </>
          )}

          {section === "usage" && (
            <>
              <PageHead title="Usage" subtitle="Tokens per customer this cycle. You are alerted at 80% and when a customer is stopped at 100%." />
              <UsageTab agency={agency} poolById={poolById} />
            </>
          )}

          {section === "team" && (
            <>
              <PageHead title="Team" subtitle="Who at your agency can use this portal, and what each role can do." />
              <RoleCards />
              <StaffTab agency={agency} onInvite={() => setShowInviteStaff(true)} canInvite={can.team} />
            </>
          )}

          {section === "activity" && (
            <>
              <PageHead title="Activity" subtitle="Everything done in your agency and in your customers' accounts." />
              <ActivityTab entries={agency.activity} />
            </>
          )}

          {section === "billing" && <Billing agency={agency} />}
        </div>
      </main>

      {/* Modals */}
      {showActivate && (
        <ActivateModal
          agency={agency}
          onClose={() => setShowActivate(false)}
          onSave={(company, email, poolId, invite) => { actions.activate(company, email, poolId, invite); setShowActivate(false); }}
        />
      )}
      {substituteFor && (
        <SubstituteModal
          client={substituteFor}
          pool={poolById(substituteFor.poolId)}
          allowOverride={false}
          onClose={() => setSubstituteFor(null)}
          onSave={(company, email) => { actions.substitute(substituteFor, company, email, false); setSubstituteFor(null); }}
        />
      )}
      {deactivateFor && (
        <Modal title={`Deactivate ${deactivateFor.company}?`} subtitle="The seat is freed straight away." onClose={() => setDeactivateFor(null)}>
          <p className="text-sm text-white/60">
            The account is frozen, not deleted. You can export it or restore it for 60 days while a seat is free. After that it is purged.
          </p>
          <div className="mt-6 flex gap-3">
            <button onClick={() => setDeactivateFor(null)} className={secondaryBtn}>Cancel</button>
            <button
              onClick={() => { actions.deactivate(deactivateFor); setDeactivateFor(null); }}
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
          onSave={(name, email, role) => { actions.inviteStaff(name, email, role); setShowInviteStaff(false); }}
        />
      )}
      {showRequestSeats && (
        <RequestSeatsModal
          agency={agency}
          onClose={() => setShowRequestSeats(false)}
          onSave={(pool, seats, message) => { requestSeats(pool, seats, message); setShowRequestSeats(false); }}
        />
      )}
      {workspaceFor && (
        <WorkspacePreview
          agency={agency}
          client={workspaceFor}
          pool={poolById(workspaceFor.poolId)}
          actorEmail={me.email}
          onExit={() => setWorkspaceFor(null)}
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

/* ──────────────── SECTIONS ──────────────── */

function Overview({
  agency, me, can, poolById, onAdd, onOpen, onGo, onResend,
}: {
  agency: Agency;
  me: StaffMember;
  can: { manage: boolean; open: boolean; team: boolean };
  poolById: (id: string) => SeatPool;
  onAdd: () => void;
  onOpen: (c: AgencyClient) => void;
  onGo: (s: Section) => void;
  onResend: (c: AgencyClient) => void;
}) {
  const live = agency.clients.filter((c) => c.status !== "archived");
  const pctOf = (c: AgencyClient) => (c.tokensUsed / poolById(c.poolId).monthlyTokenLimit) * 100;
  const seats = agency.pools.reduce((s, p) => s + p.seats, 0);

  const attention = useMemo(() => {
    const items: { id: string; tone: "red" | "amber" | "sky"; icon: React.ElementType; title: string; detail: string; client?: AgencyClient; kind: "limit" | "invite" | "expiry" }[] = [];
    live.forEach((c) => {
      const pct = pctOf(c);
      if (pct >= 100) items.push({ id: `l-${c.id}`, tone: "red", icon: AlertTriangle, title: `${c.company} is stopped`, detail: `Used all ${formatTokens(poolById(c.poolId).monthlyTokenLimit)} tokens this cycle`, client: c, kind: "limit" });
      else if (pct >= 80) items.push({ id: `l-${c.id}`, tone: "amber", icon: Gauge, title: `${c.company} at ${Math.round(pct)}%`, detail: "Close to this cycle's token limit", client: c, kind: "limit" });
      if (!c.lastActive) items.push({ id: `i-${c.id}`, tone: "sky", icon: Mail, title: `${c.company} never logged in`, detail: c.status === "invited" ? "Invitation not accepted yet" : "Account ready, customer has not signed in", client: c, kind: "invite" });
    });
    agency.pools.forEach((p) => {
      const d = daysUntil(p.validUntil);
      if (d >= 0 && d <= 30) items.push({ id: `e-${p.id}`, tone: "amber", icon: CalendarClock, title: `${p.membership} seats expire in ${d} days`, detail: `Renew before ${formatDate(p.validUntil)} to keep customers active`, kind: "expiry" });
    });
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agency]);

  const toneCls = { red: "bg-red-500/15 text-red-400", amber: "bg-amber-500/15 text-amber-400", sky: "bg-sky-500/15 text-sky-400" };
  const firstName = me.name.split(" ")[0];

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {firstName}</h1>
          <p className="text-sm text-white/50">{agency.name} · signed in as <span className="capitalize">{me.role}</span></p>
        </div>
        {can.manage && (
          <button onClick={onAdd} className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-500">
            <UserPlus size={15} /> Add customer
          </button>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Tile icon={Users} tone="bg-sky-500/15 text-sky-400" label="Active customers" value={String(live.filter((c) => c.status === "active").length)} />
        <Tile icon={Layers} tone="bg-indigo-500/15 text-indigo-400" label="Free seats" value={`${seats - live.length}`} suffix={`of ${seats}`} />
        <Tile icon={Gauge} tone="bg-amber-500/15 text-amber-400" label="Near or over limit" value={String(live.filter((c) => pctOf(c) >= 80).length)} />
        <Tile icon={Mail} tone="bg-teal-500/15 text-teal-400" label="Never logged in" value={String(live.filter((c) => !c.lastActive).length)} />
      </div>

      <PoolCards agency={agency} />

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* Needs attention */}
        <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-5">
          <p className="mb-4 text-sm font-semibold">Needs attention</p>
          {attention.length === 0 && <p className="py-6 text-center text-sm text-white/40">All good — nothing needs you right now.</p>}
          <div className="space-y-2">
            {attention.map((a) => {
              const Icon = a.icon;
              return (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${toneCls[a.tone]}`}><Icon size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{a.title}</p>
                    <p className="truncate text-xs text-white/40">{a.detail}</p>
                  </div>
                  {a.kind === "limit" && a.client && can.open && (
                    <button onClick={() => onOpen(a.client!)} className="whitespace-nowrap rounded-lg bg-sky-500/10 px-2.5 py-1.5 text-xs font-medium text-sky-400 hover:bg-sky-500/20">Open</button>
                  )}
                  {a.kind === "invite" && a.client && can.manage && (
                    <button onClick={() => onResend(a.client!)} className="whitespace-nowrap rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10">Resend invite</button>
                  )}
                  {a.kind === "expiry" && can.manage && (
                    <button onClick={() => onGo("seats")} className="whitespace-nowrap rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10">Renew</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick workspace switch + recent activity */}
        <div className="space-y-6">
          {can.open && (
            <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-5">
              <p className="mb-1 text-sm font-semibold">Jump into a customer</p>
              <p className="mb-4 text-xs text-white/40">Work inside their AI Team with their agents and knowledge base.</p>
              <div className="space-y-1.5">
                {live.filter((c) => c.status === "active").slice(0, 4).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onOpen(c)}
                    className="group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/5"
                  >
                    <span className="truncate text-white/80 group-hover:text-white">{c.company}</span>
                    <ExternalLink size={14} className="text-white/20 group-hover:text-sky-400" />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Recent activity</p>
              {me.role !== "operator" && (
                <button onClick={() => onGo("activity")} className="text-xs text-sky-400 hover:text-sky-300">See all</button>
              )}
            </div>
            <div className="space-y-3">
              {agency.activity.slice(0, 5).map((e) => (
                <div key={e.id} className="text-xs">
                  <p className="text-white/80">{e.action} · <span className="text-white/50">{e.target}</span></p>
                  <p className="text-white/30">{e.actor} · {e.date}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PoolCards({ agency }: { agency: Agency }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {agency.pools.map((pool) => {
        const used = seatsInUse(agency, pool.id);
        const left = daysUntil(pool.validUntil);
        return (
          <div key={pool.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/35">Your seats</p>
                <p className="font-semibold">{pool.membership}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {pool.agents.map((a) => (
                  <span key={a} className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">{a}</span>
                ))}
              </div>
            </div>
            <p className="mb-2 text-sm text-white/60">
              <span className="text-2xl font-bold text-white">{used}</span> of {pool.seats} seats in use
              <span className={`ml-2 text-xs ${used >= pool.seats ? "text-amber-400" : "text-white/40"}`}>
                {used >= pool.seats ? "· full" : `· ${pool.seats - used} free`}
              </span>
            </p>
            <SeatBar used={used} total={pool.seats} />
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-white/40">
              <span>Valid until {formatDate(pool.validUntil)} <span className={left <= 30 ? "text-amber-400" : ""}>({left}d)</span></span>
              <span className="font-mono text-sky-300/80">{formatTokens(pool.monthlyTokenLimit)} tokens / seat / 30d</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Billing({ agency }: { agency: Agency }) {
  return (
    <>
      <PageHead title="Billing" subtitle="Buy, add or remove seats and download invoices." />
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-sm text-indigo-200">
        <Lock size={16} className="mt-0.5 flex-shrink-0" />
        Self-serve billing arrives in phase 3. Until then AI Team grants seats and invoices you directly. The prices below are samples.
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {agency.pools.map((p) => {
          const price = PRICE_PER_SEAT_EUR[p.membership] ?? 0;
          return (
            <div key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[10px] uppercase tracking-wider text-white/35">Subscription</p>
              <p className="mb-3 font-semibold">{p.membership}</p>
              <p className="text-sm text-white/60">
                <span className="text-2xl font-bold text-white">€{(price * p.seats).toLocaleString("en-GB")}</span> / month
              </p>
              <p className="mb-4 text-xs text-white/40">{p.seats} seats × €{price} · renews {formatDate(p.validUntil)}</p>
              <div className="flex gap-2">
                <button disabled className="flex-1 cursor-not-allowed rounded-xl bg-sky-600/40 py-2 text-sm font-semibold text-white/60">Add seats</button>
                <button disabled className="flex-1 cursor-not-allowed rounded-xl border border-white/10 py-2 text-sm text-white/40">Remove seats</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0F172A]">
        <table className="w-full text-left text-sm text-white/70">
          <thead className="border-b border-white/10 bg-white/5 text-[10px] uppercase tracking-wider text-white/40">
            <tr>
              <th className="px-4 py-4 font-semibold">Invoice</th>
              <th className="px-4 py-4 font-semibold">Date</th>
              <th className="px-4 py-4 font-semibold">For</th>
              <th className="px-4 py-4 text-right font-semibold">Amount</th>
              <th className="px-4 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {agency.ledger.filter((l) => l.note && l.change > 0).reverse().map((l) => {
              const pool = agency.pools.find((p) => p.id === l.poolId)!;
              const amount = (PRICE_PER_SEAT_EUR[pool.membership] ?? 0) * l.change * 12;
              return (
                <tr key={l.id} className="border-b border-white/5">
                  <td className="px-4 py-4 font-mono text-xs text-white"><Receipt size={13} className="mr-2 inline text-white/30" />{l.note}</td>
                  <td className="px-4 py-4 text-xs">{formatDate(l.date)}</td>
                  <td className="px-4 py-4 text-xs">{l.change} × {pool.membership}, 12 months</td>
                  <td className="px-4 py-4 text-right font-mono">€{amount.toLocaleString("en-GB")}</td>
                  <td className="px-4 py-4 text-right">
                    <button disabled className="cursor-not-allowed text-white/20"><Download size={15} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ──────────────── SMALL PIECES ──────────────── */

function RoleSwitcher({ staff, me, onChange }: { staff: StaffMember[]; me: StaffMember; onChange: (m: StaffMember) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0F172A] py-1.5 pl-1.5 pr-3 text-sm transition hover:bg-white/5"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/25 text-[11px] font-bold text-indigo-200">
          {me.name.split(" ").map((w) => w[0]).join("")}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-xs text-white">{me.name}</span>
          <span className="block text-[10px] capitalize text-white/40">{me.role}</span>
        </span>
        <ChevronDown size={14} className={`text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-white/10 bg-[#0B1221] p-2 shadow-2xl shadow-black/40">
          <p className="px-2 pb-2 pt-1 text-[10px] uppercase tracking-widest text-white/30">Demo · view the portal as</p>
          {staff.map((m) => (
            <button
              key={m.id}
              onClick={() => { onChange(m); setOpen(false); }}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition ${m.id === me.id ? "bg-sky-500/10" : "hover:bg-white/5"}`}
            >
              <span>
                <span className="block text-sm text-white">{m.name}</span>
                <span className="block text-[10px] text-white/40">{roleHint[m.role]}</span>
              </span>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize ${roleBadge[m.role]}`}>{m.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RoleCards() {
  const rows: { role: StaffRole; does: string[] }[] = [
    { role: "owner", does: ["Everything a manager can", "Billing and invoices", "Invite and remove staff"] },
    { role: "manager", does: ["Add, swap and deactivate customers", "Request seats", "Open workspaces"] },
    { role: "operator", does: ["Open customer workspaces", "Work in their agents"] },
    { role: "viewer", does: ["See customers, usage and activity"] },
  ];
  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {rows.map((r) => (
        <div key={r.role} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize ${roleBadge[r.role]}`}>{r.role}</span>
          <ul className="mt-3 space-y-1 text-xs text-white/60">
            {r.does.map((d) => <li key={d}>· {d}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function RequestSeatsModal({
  agency, onClose, onSave,
}: {
  agency: Agency;
  onClose: () => void;
  onSave: (pool: SeatPool, seats: number, message: string) => void;
}) {
  const [poolId, setPoolId] = useState(agency.pools[0].id);
  const [seats, setSeats] = useState(3);
  const [message, setMessage] = useState("");
  const pool = agency.pools.find((p) => p.id === poolId)!;
  return (
    <Modal title="Request more seats" subtitle="AI Team confirms and sends the invoice. New seats are added at once." onClose={onClose}>
      <div className="space-y-4">
        {agency.pools.length > 1 && (
          <div>
            <label className={labelCls}>Seat pool</label>
            <select value={poolId} onChange={(e) => setPoolId(e.target.value)} className={inputCls}>
              {agency.pools.map((p) => <option key={p.id} value={p.id} className="bg-[#0B1221]">{p.membership}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className={labelCls}>Extra seats</label>
          <input type="number" min={1} value={seats} onChange={(e) => setSeats(Math.max(1, Number(e.target.value) || 1))} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Message (optional)</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Three new restaurant clients start next week" className={inputCls} />
        </div>
        <InfoBox>
          {pool.membership} goes from {pool.seats} to <span className="font-semibold text-white">{pool.seats + seats}</span> seats, valid until {formatDate(pool.validUntil)}.
          To reduce seats, contact AI Team; reductions apply at the end of the period.
        </InfoBox>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className={secondaryBtn}>Cancel</button>
          <button onClick={() => onSave(pool, seats, message.trim())} className={primaryBtn}>Send request</button>
        </div>
      </div>
    </Modal>
  );
}

function PageHead({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-white/50">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function RoleNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs text-white/50">
      <Building2 size={14} className="flex-shrink-0 text-white/30" /> {children}
    </div>
  );
}

function Tile({ icon: Icon, tone, label, value, suffix }: { icon: React.ElementType; tone: string; label: string; value: string; suffix?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon size={18} /></div>
      <div className="min-w-0">
        <p className="truncate text-[10px] uppercase tracking-wider text-white/35">{label}</p>
        <p className="text-xl font-bold">{value}{suffix && <span className="ml-1.5 text-xs font-normal text-white/40">{suffix}</span>}</p>
      </div>
    </div>
  );
}
