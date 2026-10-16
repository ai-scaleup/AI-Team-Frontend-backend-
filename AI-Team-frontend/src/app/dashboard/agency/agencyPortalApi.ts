import { API_BASE } from "@/lib/apiBase";
import { authenticatedFetch } from "@/lib/authenticatedFetch";
import { AgencyResponse, LoginLink, errorMessage, toAgency } from "../admin/agencies/agenciesApi";
import type { Agency, AgencyBrandingSettings, StaffMember, StaffRole } from "../admin/agencies/agencyTypes";

// The agency portal on the server (/agency-portal). The server checks the
// signed-in user's staff role on every call; the page only hides what a role
// cannot do.

export type PortalAgency = { id: string; name: string; role: StaffRole; viaAdmin: boolean };

export type PortalView = { agency: Agency; me: StaffMember };

type PortalResponse = AgencyResponse & { me: { name: string; email: string; role: string } };

const toView = (r: PortalResponse): PortalView => ({
  agency: toAgency(r),
  me: { id: r.me.email, name: r.me.name, email: r.me.email, role: r.me.role.toLowerCase() as StaffRole },
});

async function call<T>(path: string, init?: { method: string; body?: unknown }): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE}/agency-portal${path}`, {
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
const post = async (path: string, body?: unknown) =>
  toView(await call<PortalResponse>(path, { method: "POST", body }));

export async function fetchMyAgencies(): Promise<PortalAgency[]> {
  const r = await call<{ agencies: { id: string; name: string; role: string; viaAdmin: boolean }[] }>("/me");
  return r.agencies.map((a) => ({ ...a, role: a.role.toLowerCase() as StaffRole }));
}

export const fetchPortalAgency = async (id: string) => toView(await call<PortalResponse>(`/${enc(id)}`));

export const portalActivate = (id: string, input: { company: string; email: string; poolId: string; invite: boolean }) =>
  post(`/${enc(id)}/customers`, input);

export const portalDeactivate = (id: string, customerId: string) =>
  post(`/${enc(id)}/customers/${enc(customerId)}/deactivate`);

export const portalRestore = (id: string, customerId: string) =>
  post(`/${enc(id)}/customers/${enc(customerId)}/restore`);

export const portalSubstitute = (id: string, customerId: string, input: { company: string; email: string }) =>
  post(`/${enc(id)}/customers/${enc(customerId)}/substitute`, input);

export const portalInviteStaff = (id: string, input: { name: string; email: string; role: StaffRole }) =>
  post(`/${enc(id)}/staff`, { ...input, role: input.role.toUpperCase() });

export const portalRequestSeats = (id: string, input: { poolId: string; seats: number; message: string }) =>
  post(`/${enc(id)}/seat-requests`, input);

/** Your product name, logo and colour (owner). */
export const portalSetBranding = async (id: string, input: AgencyBrandingSettings) =>
  toView(await call<PortalResponse>(`/${enc(id)}/branding`, { method: "PUT", body: input }));

/** A one-time setup link code for a customer (owner, manager). */
export const portalLoginLink = (id: string, customerId: string) =>
  call<LoginLink>(`/${enc(id)}/customers/${enc(customerId)}/login-link`, { method: "POST" });
