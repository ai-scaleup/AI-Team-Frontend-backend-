"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard, Users, Layers, Gauge, ShieldCheck, ScrollText, CreditCard,
  ArrowLeft, UserPlus, AlertTriangle, Mail, CalendarClock,
  CheckCircle2, ChevronDown, Send, Lock, Receipt, Building2, Loader2, Palette,
} from "lucide-react";
import { BrandingForm, LoginLinkModal, SignInAddress } from "../admin/agencies/WhiteLabel";
import {
  ActivateModal, ActivityTab, CustomersTab, ErrorBox, InfoBox, InviteStaffModal, LedgerTab,
  Modal, SeatBar, StaffTab, SubstituteModal, UsageTab,
  inputCls, labelCls, primaryBtn, roleBadge, secondaryBtn,
} from "../admin/agencies/AgencyDetail";
import {
  Agency, AgencyClient, SeatPool, StaffMember, StaffRole,
  daysUntil, formatDate, formatTokens, seatsInUse,
} from "../admin/agencies/agencyTypes";
import { todayIso } from "../admin/agencies/agenciesApi";
import {
  PortalAgency, PortalView, fetchMyAgencies, fetchPortalAgency, portalActivate, portalDeactivate,
  portalInviteStaff, portalLoginLink, portalRequestSeats, portalRestore, portalSetBranding, portalSubstitute,
} from "./agencyPortalApi";

type Section = "overview" | "customers" | "seats" | "usage" | "team" | "activity" | "branding" | "billing";

const NAV: { id: Section; label: string; icon: React.ElementType; roles: StaffRole[] }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, roles: ["owner", "manager", "operator", "viewer"] },
  { id: "customers", label: "Customers", icon: Users, roles: ["owner", "manager", "operator", "viewer"] },
  { id: "seats", label: "Seats", icon: Layers, roles: ["owner", "manager"] },
  { id: "usage", label: "Usage", icon: Gauge, roles: ["owner", "manager", "viewer"] },
  { id: "team", label: "Team", icon: ShieldCheck, roles: ["owner", "manager"] },
  { id: "activity", label: "Activity", icon: ScrollText, roles: ["owner", "manager", "viewer"] },
  { id: "branding", label: "Branding", icon: Palette, roles: ["owner"] },
  { id: "billing", label: "Billing", icon: CreditCard, roles: ["owner"] },
];

const SELECTED_KEY = "agency_portal_selected";

const initials = (name: string) => name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

/* ──────────────── PAGE ──────────────── */

export default function AgencyPortalPage() {
  // Everything here is saved on the server, which checks the signed-in
  // user's staff role on every call.
  const [mine, setMine] = useState<PortalAgency[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<PortalView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("overview");
  const [toast, setToast] = useState<string | null>(null);

  const [showActivate, setShowActivate] = useState(false);
  const [substituteFor, setSubstituteFor] = useState<AgencyClient | null>(null);
  const [deactivateFor, setDeactivateFor] = useState<AgencyClient | null>(null);
  const [showInviteStaff, setShowInviteStaff] = useState(false);
  const [showRequestSeats, setShowRequestSeats] = useState(false);
  const [loginLinkFor, setLoginLinkFor] = useState<AgencyClient | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    fetchMyAgencies()
      .then((list) => {
        if (cancelled) return;
        setMine(list);
        let saved: string | null = null;
        try { saved = localStorage.getItem(SELECTED_KEY); } catch { /* storage blocked */ }
        setSelectedId(list.find((a) => a.id === saved)?.id ?? list[0]?.id ?? null);
      })
      .catch((e) => { if (!cancelled) setLoadError(e instanceof Error ? e.message : "Unable to load your agencies."); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    fetchPortalAgency(selectedId)
      .then((v) => { if (!cancelled) setView(v); })
      .catch((e) => { if (!cancelled) setLoadError(e instanceof Error ? e.message : "Unable to load the agency."); });
    return () => { cancelled = true; };
  }, [selectedId]);

  const switchAgency = (id: string) => {
    try { localStorage.setItem(SELECTED_KEY, id); } catch { /* storage blocked */ }
    setView(null);
    setLoadError(null);
    setSection("overview");
    setSelectedId(id);
  };

  if (loadError) return <Shell><div className="mx-auto mt-24 max-w-md"><ErrorBox>{loadError}</ErrorBox></div></Shell>;
  if (mine && mine.length === 0) {
    return (
      <Shell>
        <div className="mx-auto mt-24 max-w-md rounded-2xl border border-white/10 bg-[#0F172A] p-8 text-center">
          <Building2 size={28} className="mx-auto mb-3 text-white/30" />
          <p className="font-semibold">You are not on any agency&apos;s staff</p>
          <p className="mt-1 text-sm text-white/50">Ask your agency&apos;s owner to add your email in the portal&apos;s Team section.</p>
        </div>
      </Shell>
    );
  }
  if (!view || !mine) {
    return <Shell><div className="mt-32 flex justify-center text-white/40"><Loader2 className="animate-spin" /></div></Shell>;
  }

  const { agency, me } = view;
  const current = mine.find((a) => a.id === agency.id);
  const can = {
    manage: me.role === "owner" || me.role === "manager",
    team: me.role === "owner",
  };
  const poolById = (id: string) => agency.pools.find((p) => p.id === id)!;
  const nav = NAV.filter((n) => n.roles.includes(me.role));
  const shown: Section = nav.some((n) => n.id === section) ? section : "overview";
  const live = agency.clients.filter((c) => c.status !== "archived");

  // Every action saves on the server and swaps in the agency it sends back.
  const save = async (request: Promise<PortalView>, message: string) => {
    setView(await request);
    setToast(message);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#020617] text-white">
      {/* Sidebar */}
      <aside className="hidden h-screen w-64 flex-shrink-0 flex-col border-r border-white/10 bg-[#0B1221] md:flex">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500/30 to-indigo-500/30 text-xs font-bold text-sky-300">{initials(agency.name)}</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{agency.name}</p>
            <p className="text-[10px] uppercase tracking-wider text-white/35">Agency portal</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1.5 p-4">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = shown === item.id;
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
            <div className="flex items-center gap-2 text-xs text-white/40">
              {current?.viaAdmin && (
                <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-300">AI Team admin · support view</span>
              )}
            </div>
            <AccountMenu me={me} agencies={mine} currentId={agency.id} onSwitch={switchAgency} />
          </div>
          {/* Mobile nav */}
          <div className="flex gap-1 overflow-x-auto px-4 pb-3 md:hidden">
            {nav.map((item) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
                  shown === item.id ? "bg-sky-500/20 text-sky-300" : "text-white/50"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-[1400px] p-4 md:p-8">
          {agency.status !== "active" && (
            <div className={`mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm ${agency.status === "grace" ? "border-amber-500/20 bg-amber-500/10 text-amber-200" : "border-red-500/20 bg-red-500/10 text-red-200"}`}>
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              {agency.status === "grace"
                ? "Your payment is late. Everything keeps working for now; please contact AI Team to avoid a suspension."
                : "Your agency is suspended. You cannot add or swap customers until AI Team reactivates it. No data has been deleted."}
            </div>
          )}

          {shown === "overview" && (
            <Overview
              agency={agency}
              me={me}
              can={can}
              poolById={poolById}
              onAdd={() => setShowActivate(true)}
              onGo={setSection}
            />
          )}

          {shown === "customers" && (
            <>
              <PageHead
                title="Customers"
                subtitle={`${live.length} customers on ${agency.pools.reduce((s, p) => s + p.seats, 0)} seats`}
                action={can.manage && (
                  <button
                    onClick={() => setShowActivate(true)}
                    disabled={agency.status === "suspended" || agency.pools.length === 0}
                    className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <UserPlus size={15} /> Add customer
                  </button>
                )}
              />
              {me.role === "operator" && <RoleNote>As an operator you will open customer workspaces once seats give chat access. Seats and customers are managed by the owner or a manager.</RoleNote>}
              {me.role === "viewer" && <RoleNote>As a viewer you can see customers and reports, but not change them.</RoleNote>}
              <CustomersTab
                agency={agency}
                poolById={poolById}
                onOpen={() => {}}
                onSubstitute={setSubstituteFor}
                onDeactivate={setDeactivateFor}
                onRestore={(c) =>
                  save(portalRestore(agency.id, c.id), `${c.company} restored`).catch((e) =>
                    setToast(e instanceof Error ? e.message : "Unable to restore."),
                  )
                }
                canManage={can.manage}
                canOpen={false}
                onLoginLink={can.manage ? setLoginLinkFor : undefined}
              />
            </>
          )}

          {shown === "seats" && (
            <>
              <PageHead
                title="Seats"
                subtitle="Each seat keeps one customer active. Seats are bought from AI Team."
                action={
                  <button
                    onClick={() => setShowRequestSeats(true)}
                    disabled={agency.pools.length === 0}
                    className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-500 disabled:opacity-40"
                  >
                    <Send size={15} /> Request more seats
                  </button>
                }
              />
              <PoolCards agency={agency} />
              <h2 className="mb-3 mt-8 text-sm font-semibold">Seat history</h2>
              <LedgerTab agency={agency} poolById={poolById} />
            </>
          )}

          {shown === "usage" && (
            <>
              <PageHead title="Usage" subtitle="Tokens per customer this cycle. You are alerted at 80% and a customer is stopped at 100%." />
              <div className="mb-4"><InfoBox>Token counting per seat starts when seats give chat access, so every customer shows 0 for now.</InfoBox></div>
              <UsageTab agency={agency} poolById={poolById} />
            </>
          )}

          {shown === "team" && (
            <>
              <PageHead title="Team" subtitle="Who at your agency can use this portal, and what each role can do." />
              <RoleCards />
              <StaffTab agency={agency} onInvite={() => setShowInviteStaff(true)} canInvite={can.team} />
            </>
          )}

          {shown === "activity" && (
            <>
              <PageHead title="Activity" subtitle="Everything done in your agency." />
              <ActivityTab entries={agency.activity} />
            </>
          )}

          {shown === "branding" && (
            <>
              <PageHead
                title="Branding"
                subtitle="Your customers sign in on your own sign-in page and see your name, logo and colour — not AI Team."
              />
              <BrandingForm
                key={agency.id}
                branding={agency.branding}
                fallbackName={agency.name}
                onSave={(input) => save(portalSetBranding(agency.id, input), "Branding saved")}
              />
              <h2 className="mb-3 mt-10 text-sm font-semibold">Your sign-in address</h2>
              <SignInAddress slug={agency.slug} />
              <p className="mt-3 text-xs text-white/40">
                To give a customer access, open Customers and use Login link: they set a password and then sign in at this address.
              </p>
            </>
          )}

          {shown === "billing" && <Billing agency={agency} />}
        </div>
      </main>

      {/* Modals */}
      {showActivate && (
        <ActivateModal
          agency={agency}
          onClose={() => setShowActivate(false)}
          onSave={async (company, email, poolId, invite) => {
            await save(portalActivate(agency.id, { company, email, poolId, invite }), `${company} now holds a seat`);
            setShowActivate(false);
          }}
        />
      )}
      {substituteFor && (
        <SubstituteModal
          client={substituteFor}
          pool={poolById(substituteFor.poolId)}
          allowOverride={false}
          onClose={() => setSubstituteFor(null)}
          onSave={async (company, email) => {
            await save(portalSubstitute(agency.id, substituteFor.id, { company, email }), `Seat moved from ${substituteFor.company} to ${company}`);
            setSubstituteFor(null);
          }}
        />
      )}
      {deactivateFor && (
        <DeactivateModal
          client={deactivateFor}
          onClose={() => setDeactivateFor(null)}
          onConfirm={async () => {
            await save(portalDeactivate(agency.id, deactivateFor.id), `${deactivateFor.company} archived — seat freed`);
            setDeactivateFor(null);
          }}
        />
      )}
      {showInviteStaff && (
        <InviteStaffModal
          onClose={() => setShowInviteStaff(false)}
          onSave={async (name, email, role) => {
            await save(portalInviteStaff(agency.id, { name, email, role }), `${name} added as ${role}`);
            setShowInviteStaff(false);
          }}
        />
      )}
      {loginLinkFor && (
        <LoginLinkModal
          customer={loginLinkFor}
          slug={agency.slug}
          onCreate={() => portalLoginLink(agency.id, loginLinkFor.id)}
          onClose={() => setLoginLinkFor(null)}
        />
      )}
      {showRequestSeats && (
        <RequestSeatsModal
          agency={agency}
          onClose={() => setShowRequestSeats(false)}
          onSave={async (pool, seats, message) => {
            await save(portalRequestSeats(agency.id, { poolId: pool.id, seats, message }), `Request for +${seats} ${pool.membership} seats sent to AI Team`);
            setShowRequestSeats(false);
          }}
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#020617] px-4 text-white">
      <div className="p-4">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-white/50 transition hover:text-white">
          <ArrowLeft size={16} /> My dashboard
        </Link>
      </div>
      {children}
    </div>
  );
}

/* ──────────────── SECTIONS ──────────────── */

function Overview({
  agency, me, can, poolById, onAdd, onGo,
}: {
  agency: Agency;
  me: StaffMember;
  can: { manage: boolean; team: boolean };
  poolById: (id: string) => SeatPool;
  onAdd: () => void;
  onGo: (s: Section) => void;
}) {
  const live = agency.clients.filter((c) => c.status !== "archived");
  const pctOf = (c: AgencyClient) => (c.tokensUsed / poolById(c.poolId).monthlyTokenLimit) * 100;
  const seats = agency.pools.reduce((s, p) => s + p.seats, 0);
  const today = todayIso();

  const attention = useMemo(() => {
    const items: { id: string; tone: "red" | "amber" | "sky"; icon: React.ElementType; title: string; detail: string; kind: "limit" | "invite" | "expiry" }[] = [];
    live.forEach((c) => {
      const pct = pctOf(c);
      if (pct >= 100) items.push({ id: `l-${c.id}`, tone: "red", icon: AlertTriangle, title: `${c.company} is stopped`, detail: `Used all ${formatTokens(poolById(c.poolId).monthlyTokenLimit)} tokens this cycle`, kind: "limit" });
      else if (pct >= 80) items.push({ id: `l-${c.id}`, tone: "amber", icon: Gauge, title: `${c.company} at ${Math.round(pct)}%`, detail: "Close to this cycle's token limit", kind: "limit" });
      if (c.status === "invited") items.push({ id: `i-${c.id}`, tone: "sky", icon: Mail, title: `${c.company} is invited`, detail: "Not signed in yet", kind: "invite" });
    });
    agency.pools.forEach((p) => {
      const d = daysUntil(p.validUntil, today);
      if (d < 0) items.push({ id: `e-${p.id}`, tone: "red", icon: CalendarClock, title: `${p.membership} seats expired ${-d} days ago`, detail: "Contact AI Team to renew", kind: "expiry" });
      else if (d <= 30) items.push({ id: `e-${p.id}`, tone: "amber", icon: CalendarClock, title: `${p.membership} seats expire in ${d} days`, detail: `Renew before ${formatDate(p.validUntil)} to keep customers active`, kind: "expiry" });
    });
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agency, today]);

  const toneCls = { red: "bg-red-500/15 text-red-400", amber: "bg-amber-500/15 text-amber-400", sky: "bg-sky-500/15 text-sky-400" };
  const firstName = me.name.includes("@") ? me.name : me.name.split(" ")[0];

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {firstName}</h1>
          <p className="text-sm text-white/50">{agency.name} · signed in as <span className="capitalize">{me.role}</span></p>
        </div>
        {can.manage && (
          <button
            onClick={onAdd}
            disabled={agency.status === "suspended" || agency.pools.length === 0}
            className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <UserPlus size={15} /> Add customer
          </button>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Tile icon={Users} tone="bg-sky-500/15 text-sky-400" label="Active customers" value={String(live.filter((c) => c.status === "active").length)} />
        <Tile icon={Layers} tone="bg-indigo-500/15 text-indigo-400" label="Free seats" value={`${Math.max(0, seats - live.length)}`} suffix={`of ${seats}`} />
        <Tile icon={Gauge} tone="bg-amber-500/15 text-amber-400" label="Near or over limit" value={String(live.filter((c) => pctOf(c) >= 80).length)} />
        <Tile icon={Mail} tone="bg-teal-500/15 text-teal-400" label="Invited, not signed in" value={String(live.filter((c) => c.status === "invited").length)} />
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
                  {a.kind === "expiry" && can.manage && (
                    <button onClick={() => onGo("seats")} className="whitespace-nowrap rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10">Seats</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent activity */}
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
            {agency.activity.length === 0 && <p className="text-xs text-white/40">Nothing yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function PoolCards({ agency }: { agency: Agency }) {
  const today = todayIso();
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {agency.pools.map((pool) => {
        const used = seatsInUse(agency, pool.id);
        const left = daysUntil(pool.validUntil, today);
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
              <span>
                Valid until {formatDate(pool.validUntil)}{" "}
                <span className={left < 0 ? "text-red-400" : left <= 30 ? "text-amber-400" : ""}>
                  ({left < 0 ? `expired ${-left}d ago` : `${left}d`})
                </span>
              </span>
              <span className="font-mono text-sky-300/80">{formatTokens(pool.monthlyTokenLimit)} tokens / seat / 30d</span>
            </div>
          </div>
        );
      })}
      {agency.pools.length === 0 && (
        <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/40">No seat pool yet. AI Team adds seats for you.</p>
      )}
    </div>
  );
}

function Billing({ agency }: { agency: Agency }) {
  const invoices = agency.ledger.filter((l) => l.note && l.change > 0).reverse();
  return (
    <>
      <PageHead title="Billing" subtitle="Your seat subscriptions and the invoice references AI Team recorded." />
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-sm text-indigo-200">
        <Lock size={16} className="mt-0.5 flex-shrink-0" />
        Self-serve billing is coming. Until then AI Team grants seats and invoices you directly; use Seats → Request more seats to ask for more.
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {agency.pools.map((p) => (
          <div key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[10px] uppercase tracking-wider text-white/35">Subscription</p>
            <p className="mb-3 font-semibold">{p.membership}</p>
            <p className="text-sm text-white/60"><span className="text-2xl font-bold text-white">{p.seats}</span> seats</p>
            <p className="text-xs text-white/40">{formatDate(p.validFrom)} – {formatDate(p.validUntil)}</p>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0F172A]">
        <table className="w-full text-left text-sm text-white/70">
          <thead className="border-b border-white/10 bg-white/5 text-[10px] uppercase tracking-wider text-white/40">
            <tr>
              <th className="px-4 py-4 font-semibold">Invoice reference</th>
              <th className="px-4 py-4 font-semibold">Date</th>
              <th className="px-4 py-4 font-semibold">For</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((l) => {
              const pool = agency.pools.find((p) => p.id === l.poolId);
              return (
                <tr key={l.id} className="border-b border-white/5">
                  <td className="px-4 py-4 font-mono text-xs text-white"><Receipt size={13} className="mr-2 inline text-white/30" />{l.note}</td>
                  <td className="px-4 py-4 text-xs">{formatDate(l.date)}</td>
                  <td className="px-4 py-4 text-xs">{l.change} × {pool?.membership ?? "seat"}</td>
                </tr>
              );
            })}
            {invoices.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-10 text-center text-white/40">No invoice references yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ──────────────── SMALL PIECES ──────────────── */

function AccountMenu({
  me, agencies, currentId, onSwitch,
}: {
  me: StaffMember;
  agencies: PortalAgency[];
  currentId: string;
  onSwitch: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const many = agencies.length > 1;
  return (
    <div className="relative">
      <button
        onClick={() => many && setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-xl border border-white/10 bg-[#0F172A] py-1.5 pl-1.5 pr-3 text-sm transition ${many ? "hover:bg-white/5" : "cursor-default"}`}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/25 text-[11px] font-bold text-indigo-200">
          {initials(me.name.includes("@") ? me.name.split("@")[0] : me.name)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-xs text-white">{me.name}</span>
          <span className="block text-[10px] capitalize text-white/40">{me.role}</span>
        </span>
        {many && <ChevronDown size={14} className={`text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 max-h-96 w-72 overflow-y-auto rounded-2xl border border-white/10 bg-[#0B1221] p-2 shadow-2xl shadow-black/40">
          <p className="px-2 pb-2 pt-1 text-[10px] uppercase tracking-widest text-white/30">Switch agency</p>
          {agencies.map((a) => (
            <button
              key={a.id}
              onClick={() => { onSwitch(a.id); setOpen(false); }}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition ${a.id === currentId ? "bg-sky-500/10" : "hover:bg-white/5"}`}
            >
              <span className="truncate text-sm text-white">{a.name}</span>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize ${roleBadge[a.role]}`}>{a.viaAdmin ? "admin" : a.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RoleCards() {
  const rows: { role: StaffRole; does: string[] }[] = [
    { role: "owner", does: ["Everything a manager can", "Billing", "Add staff"] },
    { role: "manager", does: ["Add, swap and deactivate customers", "Request seats"] },
    { role: "operator", does: ["See customers", "Open customer workspaces (coming)"] },
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

function DeactivateModal({ client, onClose, onConfirm }: { client: AgencyClient; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try { await onConfirm(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to deactivate."); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Deactivate ${client.company}?`} subtitle="The seat is freed straight away." onClose={onClose}>
      <p className="text-sm text-white/60">
        The customer is archived, not deleted. You can restore it from &quot;Show archived&quot; while a seat is free.
      </p>
      {error && <div className="mt-4"><ErrorBox>{error}</ErrorBox></div>}
      <div className="mt-6 flex gap-3">
        <button onClick={onClose} className={secondaryBtn}>Cancel</button>
        <button
          onClick={confirm}
          disabled={busy}
          className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-40"
        >
          {busy ? "Deactivating…" : "Deactivate"}
        </button>
      </div>
    </Modal>
  );
}

function RequestSeatsModal({
  agency, onClose, onSave,
}: {
  agency: Agency;
  onClose: () => void;
  onSave: (pool: SeatPool, seats: number, message: string) => Promise<void>;
}) {
  const [poolId, setPoolId] = useState(agency.pools[0].id);
  const [seats, setSeats] = useState(3);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pool = agency.pools.find((p) => p.id === poolId)!;
  const send = async () => {
    setBusy(true);
    setError(null);
    try { await onSave(pool, seats, message.trim()); } catch (e) { setError(e instanceof Error ? e.message : "Unable to send the request."); } finally { setBusy(false); }
  };
  return (
    <Modal title="Request more seats" subtitle="AI Team confirms, adds the seats and sends the invoice." onClose={onClose}>
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
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={300} placeholder="Three new restaurant clients start next week" className={inputCls} />
        </div>
        <InfoBox>
          Once AI Team approves, {pool.membership} goes from {pool.seats} to <span className="font-semibold text-white">{pool.seats + seats}</span> seats, valid until {formatDate(pool.validUntil)}.
          To reduce seats, contact AI Team.
        </InfoBox>
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className={secondaryBtn}>Cancel</button>
          <button onClick={send} disabled={busy} className={primaryBtn}>{busy ? "Sending…" : "Send request"}</button>
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
