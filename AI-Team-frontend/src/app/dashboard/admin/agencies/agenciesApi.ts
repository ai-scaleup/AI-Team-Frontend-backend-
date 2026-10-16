import { API_BASE } from "@/lib/apiBase";
import { authenticatedFetch } from "@/lib/authenticatedFetch";
import type { ActivityEntry, Agency, AgencyBrandingSettings, AgencyClient, LedgerEntry, StaffRole } from "./agencyTypes";

// Agencies on the server (superadmin). Records only for now: a customer on a
// seat does not get chat access from these yet.

type ServerStatus = "ACTIVE" | "GRACE" | "SUSPENDED";
type ServerCustomerStatus = "ACTIVE" | "INVITED" | "ARCHIVED";
type ServerRole = "OWNER" | "MANAGER" | "OPERATOR" | "VIEWER";

export type AgencyResponse = {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  country: string | null;
  status: ServerStatus;
  createdAt: string;
  pools: {
    id: string;
    agencyMembershipId: string;
    membership: string;
    agents: string[];
    monthlyTokenLimit: number;
    seats: number;
    validFrom: string;
    validUntil: string;
  }[];
  customers: {
    id: string;
    poolId: string;
    company: string;
    email: string;
    status: ServerCustomerStatus;
    usedTokens: number;
    cycleStartsAt: string;
    lastActiveAt: string | null;
    swappedThisCycle: boolean;
    archivedAt: string | null;
    hasLogin?: boolean;
  }[];
  staff: { id: string; name: string; email: string; role: ServerRole }[];
  branding?: AgencyBrandingSettings | null;
  domains?: { id: string; hostname: string }[];
  ledger?: { id: string; poolId: string; change: number; reason: string; note: string | null; createdBy: string; createdAt: string }[];
  activity?: { id: string; actor: string; actingAs: string | null; action: string; target: string; createdAt: string }[];
};

export async function errorMessage(response: Response) {
  try {
    const payload = await response.json();
    if (typeof payload?.message === "string") return payload.message;
    if (Array.isArray(payload?.message)) return payload.message.join(", ");
  } catch {
    // Fall back to status text.
  }
  return response.statusText || "Request failed";
}

/** The pages format dates from YYYY-MM-DD. */
const isoDay = (iso: string) => iso.slice(0, 10);

/** Local "YYYY-MM-DD HH:mm", as the activity log shows it. */
const stamp = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Today as YYYY-MM-DD in local time — real data counts days from now. */
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const toAgency = (a: AgencyResponse): Agency => ({
  id: a.id,
  name: a.name,
  slug: a.slug,
  owner: { name: a.ownerName, email: a.ownerEmail },
  status: a.status.toLowerCase() as Agency["status"],
  createdOn: isoDay(a.createdAt),
  country: a.country ?? "",
  pools: a.pools.map((p) => ({
    id: p.id,
    agencyMembershipId: p.agencyMembershipId,
    membership: p.membership,
    agents: p.agents,
    monthlyTokenLimit: p.monthlyTokenLimit,
    validFrom: isoDay(p.validFrom),
    validUntil: isoDay(p.validUntil),
    seats: p.seats,
  })),
  clients: a.customers.map((c): AgencyClient => ({
    id: c.id,
    company: c.company,
    email: c.email,
    status: c.status.toLowerCase() as AgencyClient["status"],
    poolId: c.poolId,
    tokensUsed: c.usedTokens,
    cycleStart: isoDay(c.cycleStartsAt),
    lastActive: c.lastActiveAt ? isoDay(c.lastActiveAt) : null,
    swappedThisCycle: c.swappedThisCycle,
    archivedOn: c.archivedAt ? isoDay(c.archivedAt) : undefined,
    hasLogin: c.hasLogin,
  })),
  ledger: (a.ledger ?? []).map((l): LedgerEntry => ({
    id: l.id,
    date: isoDay(l.createdAt),
    poolId: l.poolId,
    change: l.change,
    reason: l.reason,
    by: l.createdBy,
    note: l.note ?? undefined,
  })),
  activity: (a.activity ?? []).map((e): ActivityEntry => ({
    id: e.id,
    date: stamp(e.createdAt),
    actor: e.actor,
    actingAs: e.actingAs ?? undefined,
    action: e.action,
    target: e.target,
  })),
  staff: a.staff.map((s) => ({ id: s.id, name: s.name, email: s.email, role: s.role.toLowerCase() as StaffRole })),
  branding: a.branding ?? null,
  domains: (a.domains ?? []).map((d) => ({ id: d.id, hostname: d.hostname })),
});

async function call(path: string, init?: { method: string; body?: unknown }): Promise<AgencyResponse> {
  const response = await authenticatedFetch(`${API_BASE}/admin/agencies${path}`, {
    method: init?.method ?? "GET",
    cache: "no-store",
    ...(init?.body !== undefined
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(init.body) }
      : {}),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json();
}

const enc = encodeURIComponent;

/** Without ledger and activity — the detail view loads those. */
export async function fetchAgencies(): Promise<Agency[]> {
  const response = await authenticatedFetch(`${API_BASE}/admin/agencies`, { cache: "no-store" });
  if (!response.ok) throw new Error(await errorMessage(response));
  return ((await response.json()) as AgencyResponse[]).map(toAgency);
}

export const fetchAgency = async (id: string) => toAgency(await call(`/${enc(id)}`));

export const createAgency = async (input: {
  name: string;
  ownerName: string;
  ownerEmail: string;
  country: string;
  agencyMembershipId: string;
  seats: number;
  validUntil: string;
  note: string;
}) => toAgency(await call("", { method: "POST", body: input }));

export const updateAgency = async (
  id: string,
  input: { name?: string; ownerName?: string; ownerEmail?: string; country?: string; status?: Agency["status"] },
) =>
  toAgency(
    await call(`/${enc(id)}`, {
      method: "PATCH",
      body: { ...input, ...(input.status ? { status: input.status.toUpperCase() } : {}) },
    }),
  );

/** Hides the agency; nothing is deleted. */
export async function archiveAgency(id: string): Promise<void> {
  await call(`/${enc(id)}/archive`, { method: "POST" });
}

export const addPool = async (
  id: string,
  input: { agencyMembershipId: string; seats: number; validUntil: string; note: string },
) => toAgency(await call(`/${enc(id)}/pools`, { method: "POST", body: input }));

export const updatePoolValidity = async (id: string, poolId: string, validUntil: string) =>
  toAgency(await call(`/${enc(id)}/pools/${enc(poolId)}`, { method: "PATCH", body: { validUntil } }));

export const adjustSeats = async (id: string, poolId: string, change: number, reason: string, note: string) =>
  toAgency(await call(`/${enc(id)}/pools/${enc(poolId)}/seats`, { method: "POST", body: { change, reason, note } }));

export const activateCustomer = async (id: string, input: { company: string; email: string; poolId: string; invite: boolean }) =>
  toAgency(await call(`/${enc(id)}/customers`, { method: "POST", body: input }));

export const deactivateCustomer = async (id: string, customerId: string) =>
  toAgency(await call(`/${enc(id)}/customers/${enc(customerId)}/deactivate`, { method: "POST" }));

export const restoreCustomer = async (id: string, customerId: string) =>
  toAgency(await call(`/${enc(id)}/customers/${enc(customerId)}/restore`, { method: "POST" }));

export const substituteCustomer = async (
  id: string,
  customerId: string,
  input: { company: string; email: string; override: boolean },
) => toAgency(await call(`/${enc(id)}/customers/${enc(customerId)}/substitute`, { method: "POST", body: input }));

export const inviteStaff = async (id: string, input: { name: string; email: string; role: StaffRole }) =>
  toAgency(await call(`/${enc(id)}/staff`, { method: "POST", body: { ...input, role: input.role.toUpperCase() } }));

/* ── white label ── */

export type LoginLink = { code: string; expiresAt: string };

export const setBranding = async (id: string, input: AgencyBrandingSettings) =>
  toAgency(await call(`/${enc(id)}/branding`, { method: "PUT", body: input }));

/** A one-time setup link code for a customer; older links stop working. */
export async function createLoginLink(id: string, customerId: string): Promise<LoginLink> {
  const response = await authenticatedFetch(
    `${API_BASE}/admin/agencies/${enc(id)}/customers/${enc(customerId)}/login-link`,
    { method: "POST" },
  );
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json();
}
