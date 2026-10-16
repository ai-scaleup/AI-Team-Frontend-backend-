/* Types and helpers shared by the superadmin agencies page and the agency
 * portal. Both load their data from the server.
 */

export type AgencyStatus = "active" | "grace" | "suspended";
export type ClientStatus = "active" | "invited" | "archived";
export type StaffRole = "owner" | "manager" | "operator" | "viewer";

export interface SeatPool {
  id: string;
  /** Set on server-backed pools. */
  agencyMembershipId?: string;
  membership: string;
  agents: string[];
  monthlyTokenLimit: number;
  validFrom: string;
  validUntil: string;
  seats: number;
}

export interface AgencyClient {
  id: string;
  company: string;
  email: string;
  status: ClientStatus;
  poolId: string;
  tokensUsed: number;
  cycleStart: string;
  lastActive: string | null;
  swappedThisCycle: boolean;
  archivedOn?: string;
  /** Has set a password for the agency's own address. */
  hasLogin?: boolean;
}

export interface LedgerEntry {
  id: string;
  date: string;
  poolId: string;
  change: number;
  reason: string;
  by: string;
  note?: string;
}

export interface ActivityEntry {
  id: string;
  date: string;
  actor: string;
  actingAs?: string;
  action: string;
  target: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
}

export interface Agency {
  id: string;
  name: string;
  /** The name as in its customers' address: /<slug>/dashboard. */
  slug: string;
  owner: { name: string; email: string };
  status: AgencyStatus;
  createdOn: string;
  country: string;
  pools: SeatPool[];
  clients: AgencyClient[];
  ledger: LedgerEntry[];
  activity: ActivityEntry[];
  staff: StaffMember[];
  /** White label: null until the agency sets it. */
  branding?: AgencyBrandingSettings | null;
  /** The agency's own addresses. */
  domains?: { id: string; hostname: string }[];
}

export interface AgencyBrandingSettings {
  productName: string;
  logoDataUrl: string | null;
  primaryColor: string;
}

/** An agency membership, from /admin/agency-memberships. */
export interface AgencyMembership {
  id: string;
  name: string;
  /** Team names, then single agent names. */
  agents: string[];
  teamIds: string[];
  singleAgents: string[];
  monthlyTokenLimit: number;
  createdAt: string;
}

export const seatsInUse = (agency: Agency, poolId: string) =>
  agency.clients.filter((c) => c.poolId === poolId && c.status !== "archived").length;

export const totalSeats = (agency: Agency) => agency.pools.reduce((s, p) => s + p.seats, 0);

export const totalInUse = (agency: Agency) =>
  agency.clients.filter((c) => c.status !== "archived").length;

export const formatTokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${(n / 1000).toFixed(1)}k`;

export const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Whole days from `today` (YYYY-MM-DD) to `iso`. */
export const daysUntil = (iso: string, today: string) =>
  Math.round((new Date(iso).getTime() - new Date(today).getTime()) / 86_400_000);
