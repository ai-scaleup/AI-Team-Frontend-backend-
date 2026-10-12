/* ──────────────── DEMO DATA ────────────────
 * Static mock data for the Agencies design demo. Nothing here talks to the
 * server; every action on the page only changes local React state.
 */

export type AgencyStatus = "active" | "grace" | "suspended";
export type ClientStatus = "active" | "invited" | "archived";
export type StaffRole = "owner" | "manager" | "operator" | "viewer";

export interface SeatPool {
  id: string;
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
  owner: { name: string; email: string };
  status: AgencyStatus;
  createdOn: string;
  country: string;
  pools: SeatPool[];
  clients: AgencyClient[];
  ledger: LedgerEntry[];
  activity: ActivityEntry[];
  staff: StaffMember[];
}

export const AGENCY_MEMBERSHIPS = [
  { name: "Agency Pro", agents: ["AI Team", "CHIARA_AI", "TONY", "ALEX"], monthlyTokenLimit: 400_000 },
  { name: "Agency Starter", agents: ["CHIARA_AI", "SIMONE"], monthlyTokenLimit: 150_000 },
  { name: "Agency Enterprise", agents: ["AI Team", "CHIARA_AI", "TONY", "ALEX", "SIMONE"], monthlyTokenLimit: 1_000_000 },
];

export const seatsInUse = (agency: Agency, poolId: string) =>
  agency.clients.filter((c) => c.poolId === poolId && c.status !== "archived").length;

export const totalSeats = (agency: Agency) => agency.pools.reduce((s, p) => s + p.seats, 0);

export const totalInUse = (agency: Agency) =>
  agency.clients.filter((c) => c.status !== "archived").length;

export const formatTokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${(n / 1000).toFixed(1)}k`;

export const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const daysUntil = (iso: string, today = DEMO_TODAY) =>
  Math.round((new Date(iso).getTime() - new Date(today).getTime()) / 86_400_000);

export const DEMO_TODAY = "2026-10-12";

export const INITIAL_AGENCIES: Agency[] = [
  {
    id: "ag-zeta",
    name: "Studio Zeta Digital",
    owner: { name: "Marco Bellini", email: "marco@studiozeta.it" },
    status: "active",
    createdOn: "2026-10-01",
    country: "Italy",
    pools: [
      {
        id: "pool-zeta-pro",
        membership: "Agency Pro",
        agents: ["AI Team", "CHIARA_AI", "TONY", "ALEX"],
        monthlyTokenLimit: 400_000,
        validFrom: "2026-10-01",
        validUntil: "2027-09-30",
        seats: 13,
      },
    ],
    clients: [
      { id: "c1", company: "Rossi Dental Clinic", email: "info@rossidental.it", status: "active", poolId: "pool-zeta-pro", tokensUsed: 312_400, cycleStart: "2026-10-01", lastActive: "2026-10-12", swappedThisCycle: false },
      { id: "c2", company: "Trattoria da Gino", email: "gino@trattoriagino.it", status: "active", poolId: "pool-zeta-pro", tokensUsed: 401_200, cycleStart: "2026-10-01", lastActive: "2026-10-11", swappedThisCycle: false },
      { id: "c3", company: "Ferri Immobiliare", email: "office@ferriimmobiliare.it", status: "active", poolId: "pool-zeta-pro", tokensUsed: 98_700, cycleStart: "2026-10-01", lastActive: "2026-10-09", swappedThisCycle: true },
      { id: "c4", company: "Lumen Yoga Studio", email: "hello@lumenyoga.it", status: "active", poolId: "pool-zeta-pro", tokensUsed: 45_300, cycleStart: "2026-10-01", lastActive: "2026-10-03", swappedThisCycle: false },
      { id: "c5", company: "Officina Moto Verdi", email: "verdi@motoverdi.it", status: "invited", poolId: "pool-zeta-pro", tokensUsed: 0, cycleStart: "2026-10-01", lastActive: null, swappedThisCycle: false },
      { id: "c6", company: "Bianchi Avvocati", email: "studio@bianchilegal.it", status: "active", poolId: "pool-zeta-pro", tokensUsed: 188_000, cycleStart: "2026-10-01", lastActive: "2026-10-12", swappedThisCycle: false },
      { id: "c7", company: "Caffè Aurora", email: "aurora@caffeaurora.it", status: "archived", poolId: "pool-zeta-pro", tokensUsed: 22_100, cycleStart: "2026-10-01", lastActive: "2026-10-04", swappedThisCycle: false, archivedOn: "2026-10-09" },
    ],
    ledger: [
      { id: "l1", date: "2026-10-01", poolId: "pool-zeta-pro", change: 10, reason: "Prepaid pack granted", by: "digitalcoachai@gmail.com", note: "INV-2026-0418" },
      { id: "l2", date: "2026-10-08", poolId: "pool-zeta-pro", change: 3, reason: "Agency bought more seats", by: "digitalcoachai@gmail.com", note: "INV-2026-0431" },
    ],
    activity: [
      { id: "a1", date: "2026-10-12 09:42", actor: "marco@studiozeta.it", actingAs: "Rossi Dental Clinic", action: "Opened workspace", target: "Rossi Dental Clinic" },
      { id: "a2", date: "2026-10-09 16:05", actor: "marco@studiozeta.it", action: "Substituted customer", target: "Caffè Aurora → Ferri Immobiliare" },
      { id: "a3", date: "2026-10-08 11:20", actor: "digitalcoachai@gmail.com", action: "Granted seats +3", target: "Agency Pro pool" },
      { id: "a4", date: "2026-10-06 10:11", actor: "giulia@studiozeta.it", action: "Invited customer", target: "Officina Moto Verdi" },
      { id: "a5", date: "2026-10-02 14:30", actor: "marco@studiozeta.it", action: "Activated customer", target: "Bianchi Avvocati" },
      { id: "a6", date: "2026-10-01 09:00", actor: "digitalcoachai@gmail.com", action: "Created agency", target: "Studio Zeta Digital" },
    ],
    staff: [
      { id: "s1", name: "Marco Bellini", email: "marco@studiozeta.it", role: "owner" },
      { id: "s2", name: "Giulia Neri", email: "giulia@studiozeta.it", role: "manager" },
      { id: "s3", name: "Luca Conti", email: "luca@studiozeta.it", role: "operator" },
      { id: "s4", name: "Sofia Greco", email: "sofia@studiozeta.it", role: "viewer" },
    ],
  },
  {
    id: "ag-nova",
    name: "Nova Marketing Lab",
    owner: { name: "Sara Gallo", email: "sara@novalab.agency" },
    status: "active",
    createdOn: "2026-09-15",
    country: "Italy",
    pools: [
      { id: "pool-nova-starter", membership: "Agency Starter", agents: ["CHIARA_AI", "SIMONE"], monthlyTokenLimit: 150_000, validFrom: "2026-09-15", validUntil: "2026-11-05", seats: 8 },
      { id: "pool-nova-ent", membership: "Agency Enterprise", agents: ["AI Team", "CHIARA_AI", "TONY", "ALEX", "SIMONE"], monthlyTokenLimit: 1_000_000, validFrom: "2026-09-15", validUntil: "2027-09-14", seats: 2 },
    ],
    clients: [
      { id: "n1", company: "Green Garden Srl", email: "info@greengarden.it", status: "active", poolId: "pool-nova-starter", tokensUsed: 120_000, cycleStart: "2026-09-15", lastActive: "2026-10-12", swappedThisCycle: false },
      { id: "n2", company: "Pasticceria Dolce Vita", email: "ordini@dolcevita.it", status: "active", poolId: "pool-nova-starter", tokensUsed: 149_000, cycleStart: "2026-09-15", lastActive: "2026-10-10", swappedThisCycle: false },
      { id: "n3", company: "Moretti Logistica", email: "it@morettilog.com", status: "active", poolId: "pool-nova-ent", tokensUsed: 620_000, cycleStart: "2026-09-15", lastActive: "2026-10-12", swappedThisCycle: false },
      { id: "n4", company: "Studio Fisio Ricci", email: "ricci@fisio.it", status: "active", poolId: "pool-nova-starter", tokensUsed: 0, cycleStart: "2026-09-15", lastActive: null, swappedThisCycle: false },
    ],
    ledger: [
      { id: "nl1", date: "2026-09-15", poolId: "pool-nova-starter", change: 8, reason: "Prepaid pack granted", by: "digitalcoachai@gmail.com", note: "INV-2026-0390" },
      { id: "nl2", date: "2026-09-15", poolId: "pool-nova-ent", change: 2, reason: "Prepaid pack granted", by: "digitalcoachai@gmail.com", note: "INV-2026-0391" },
    ],
    activity: [
      { id: "na1", date: "2026-10-11 18:02", actor: "system", action: "Token alert 100%", target: "Pasticceria Dolce Vita" },
      { id: "na2", date: "2026-09-16 12:40", actor: "sara@novalab.agency", action: "Activated customer", target: "Moretti Logistica" },
      { id: "na3", date: "2026-09-15 09:00", actor: "digitalcoachai@gmail.com", action: "Created agency", target: "Nova Marketing Lab" },
    ],
    staff: [
      { id: "ns1", name: "Sara Gallo", email: "sara@novalab.agency", role: "owner" },
      { id: "ns2", name: "Paolo Riva", email: "paolo@novalab.agency", role: "viewer" },
    ],
  },
  {
    id: "ag-brightlane",
    name: "Brightlane Media",
    owner: { name: "Elena Marino", email: "elena@brightlane.media" },
    status: "grace",
    createdOn: "2026-08-20",
    country: "Italy",
    pools: [
      { id: "pool-bright-pro", membership: "Agency Pro", agents: ["AI Team", "CHIARA_AI", "TONY", "ALEX"], monthlyTokenLimit: 400_000, validFrom: "2026-08-20", validUntil: "2026-10-20", seats: 5 },
    ],
    clients: [
      { id: "b1", company: "Hotel Belvedere", email: "booking@belvedere.it", status: "active", poolId: "pool-bright-pro", tokensUsed: 210_000, cycleStart: "2026-09-19", lastActive: "2026-10-07", swappedThisCycle: false },
      { id: "b2", company: "Autoscuola Rapida", email: "info@autoscuolarapida.it", status: "active", poolId: "pool-bright-pro", tokensUsed: 76_500, cycleStart: "2026-09-19", lastActive: "2026-10-01", swappedThisCycle: false },
    ],
    ledger: [
      { id: "bl1", date: "2026-08-20", poolId: "pool-bright-pro", change: 5, reason: "Prepaid pack granted", by: "digitalcoachai@gmail.com", note: "INV-2026-0352" },
    ],
    activity: [
      { id: "ba1", date: "2026-10-05 08:00", actor: "system", action: "Payment failed — grace period started", target: "Brightlane Media" },
      { id: "ba2", date: "2026-08-20 09:00", actor: "digitalcoachai@gmail.com", action: "Created agency", target: "Brightlane Media" },
    ],
    staff: [{ id: "bs1", name: "Elena Marino", email: "elena@brightlane.media", role: "owner" }],
  },
  {
    id: "ag-orbit",
    name: "Orbit Web Solutions",
    owner: { name: "Davide Fontana", email: "davide@orbitweb.io" },
    status: "suspended",
    createdOn: "2026-07-01",
    country: "Switzerland",
    pools: [
      { id: "pool-orbit-starter", membership: "Agency Starter", agents: ["CHIARA_AI", "SIMONE"], monthlyTokenLimit: 150_000, validFrom: "2026-07-01", validUntil: "2026-09-30", seats: 3 },
    ],
    clients: [
      { id: "o1", company: "Alpine Ski Rental", email: "rent@alpineski.ch", status: "active", poolId: "pool-orbit-starter", tokensUsed: 0, cycleStart: "2026-09-30", lastActive: "2026-09-28", swappedThisCycle: false },
    ],
    ledger: [
      { id: "ol1", date: "2026-07-01", poolId: "pool-orbit-starter", change: 3, reason: "Prepaid pack granted", by: "digitalcoachai@gmail.com", note: "INV-2026-0277" },
    ],
    activity: [
      { id: "oa1", date: "2026-10-07 08:00", actor: "system", action: "Agency suspended — grace period ended", target: "Orbit Web Solutions" },
    ],
    staff: [{ id: "os1", name: "Davide Fontana", email: "davide@orbitweb.io", role: "owner" }],
  },
];
