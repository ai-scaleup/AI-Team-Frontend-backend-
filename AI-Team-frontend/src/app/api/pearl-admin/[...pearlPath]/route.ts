import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  DEV_TOKEN_HEADER,
  getDevApiToken,
  getDevUserEmail,
  isDevAuthEnabled,
  USER_EMAIL_HEADER,
} from "@/lib/devToken";

type RouteContext = {
  params: Promise<{
    pearlPath: string[];
  }>;
};

type PearlCampaign = {
  id: string;
  campaignName?: string;
  outboundId?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
};

type PearlUser = {
  id: string;
  email?: string;
  username?: string | null;
  createdAt?: string;
  updatedAt?: string;
  campaignCount?: number;
  campaigns?: PearlCampaign[];
};

type PearlUsersPage = {
  data?: PearlUser[];
  meta?: { total?: number; page?: number; limit?: number; totalPages?: number };
};

/**
 * Upstream caps `limit` at 100, so the aggregated record list walks the user
 * pages instead of asking for everything at once.
 */
const UPSTREAM_USER_PAGE_SIZE = 100;
const MAX_UPSTREAM_USER_PAGES = 20;

const allowedRoutes = [
  /^admin\/user-data(?:\/by-email|\/[^/]+)?$/,
  /^admin\/users(?:\/count)?$/,
  /^admin\/users\/[^/]+\/user-data(?:\/[^/]+)?$/,
];

function pearlBaseUrl() {
  return process.env.PEARL_ADMIN_API_URL?.replace(/\/$/, "");
}

async function hasPearlAdminAssignment(email: string, token: string | null) {
  const aiTeamApiUrl = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "");
  if (!aiTeamApiUrl) return false;

  const url = new URL(`${aiTeamApiUrl}/admin/agents-by-email`);
  url.searchParams.set("email", email);
  url.searchParams.set("activeOnly", "true");

  // The development token is used first; a Clerk JWT is the fallback.
  const devToken = getDevApiToken();
  const headers: Record<string, string> = devToken
    ? { [DEV_TOKEN_HEADER]: devToken, [USER_EMAIL_HEADER]: email }
    : { Authorization: `Bearer ${token}` };

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers,
    });
    if (!response.ok) return false;

    const payload = (await response.json()) as { agents?: unknown };
    return Array.isArray(payload.agents) && payload.agents.includes("PEARL_ADMIN");
  } catch {
    return false;
  }
}

type AuthResult =
  | { error: NextResponse; adminKey?: undefined; baseUrl?: undefined }
  | { error?: undefined; adminKey: string; baseUrl: string };

/** Resolves the caller, their Pearl Admin assignment and the upstream credentials. */
async function authorize(): Promise<AuthResult> {
  // A development-token caller is trusted without a Clerk session, the same
  // way the backend's PearlAdminAccessGuard treats it.
  const devAuth = isDevAuthEnabled();

  const user = devAuth ? null : await currentUser();
  const token = devAuth ? null : await (await auth()).getToken();
  const email = devAuth
    ? getDevUserEmail()
    : user?.primaryEmailAddress?.emailAddress;

  if (!devAuth && (!email || !token)) {
    return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }

  if (!devAuth && !(await hasPearlAdminAssignment(email!, token))) {
    return {
      error: NextResponse.json(
        { message: "Pearl Admin is not assigned to this user." },
        { status: 403 },
      ),
    };
  }

  const adminKey = process.env.ADMIN_API_KEY;
  const baseUrl = pearlBaseUrl();
  if (!adminKey || !baseUrl) {
    return {
      error: NextResponse.json(
        {
          message: !baseUrl
            ? "PEARL_ADMIN_API_URL is not configured on the server."
            : "ADMIN_API_KEY is not configured on the server.",
        },
        { status: 503 },
      ),
    };
  }

  return { adminKey, baseUrl };
}

async function fetchUsersPage(baseUrl: string, adminKey: string, page: number) {
  const url = new URL(`${baseUrl}/admin/users`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(UPSTREAM_USER_PAGE_SIZE));
  url.searchParams.set("includeCampaigns", "true");

  const response = await fetch(url, {
    headers: { Accept: "application/json", "x-admin-key": adminKey },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const text = await response.text();
    let message = "Pearl API request failed.";
    try {
      const parsed = JSON.parse(text) as { message?: unknown };
      if (typeof parsed.message === "string") message = parsed.message;
    } catch {
      if (text) message = text;
    }
    throw new UpstreamError(message, response.status);
  }

  return (await response.json()) as PearlUsersPage;
}

class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Users with their campaign records nested underneath, which is what the
 * dashboard lists. Sourced from `GET /admin/users?includeCampaigns=true`
 * because upstream `GET /admin/user-data` currently answers 500 for every
 * query. Searching matches the user *and* their campaigns, so filtering,
 * sorting and pagination happen here rather than upstream.
 */
async function listUsers(request: NextRequest, baseUrl: string, adminKey: string) {
  const query = request.nextUrl.searchParams;
  const page = Math.max(1, Number(query.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.get("limit")) || 10));
  const search = (query.get("search") ?? "").trim().toLowerCase();
  const sortOrder = query.get("sortOrder") === "asc" ? "asc" : "desc";

  const users: PearlUser[] = [];
  let usersTotal = 0;

  for (let upstreamPage = 1; upstreamPage <= MAX_UPSTREAM_USER_PAGES; upstreamPage += 1) {
    const payload = await fetchUsersPage(baseUrl, adminKey, upstreamPage);
    const batch = Array.isArray(payload.data) ? payload.data : [];
    users.push(...batch);

    usersTotal = Number(payload.meta?.total ?? users.length);
    const totalPages = Number(payload.meta?.totalPages ?? 1);
    if (!batch.length || upstreamPage >= totalPages) break;
  }

  const normalized = users.map((user) => {
    const campaigns = (user.campaigns ?? []).map((campaign) => ({
      id: campaign.id,
      userId: campaign.userId ?? user.id,
      campaignName: campaign.campaignName,
      outboundId: campaign.outboundId,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    }));
    campaigns.sort(
      (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
    );

    return {
      id: user.id,
      email: user.email,
      username: user.username ?? undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      campaignCount: campaigns.length,
      campaigns,
    };
  });

  const recordsTotal = normalized.reduce((sum, user) => sum + user.campaignCount, 0);

  const filtered = search
    ? normalized.filter((user) =>
        [
          user.email,
          user.username,
          ...user.campaigns.flatMap((campaign) => [campaign.campaignName, campaign.outboundId]),
        ].some((value) => value?.toLowerCase().includes(search)),
      )
    : normalized;

  filtered.sort((a, b) => {
    const left = new Date(a.createdAt ?? 0).getTime();
    const right = new Date(b.createdAt ?? 0).getTime();
    return sortOrder === "asc" ? left - right : right - left;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;

  return NextResponse.json(
    {
      data: filtered.slice(start, start + limit),
      meta: { total, page: safePage, limit, totalPages },
      usersTotal: Number.isFinite(usersTotal) ? usersTotal : 0,
      recordsTotal,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function proxyPearlRequest(request: NextRequest, context: RouteContext) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const { adminKey, baseUrl } = auth;

  const { pearlPath } = await context.params;
  const path = pearlPath.join("/");

  if (path === "users") {
    if (request.method !== "GET") {
      return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
    }
    try {
      return await listUsers(request, baseUrl, adminKey);
    } catch (error) {
      if (error instanceof UpstreamError) {
        return NextResponse.json({ message: error.message }, { status: error.status });
      }
      return NextResponse.json(
        { message: "The Pearl API is currently unreachable." },
        { status: 502 },
      );
    }
  }

  if (!allowedRoutes.some((route) => route.test(path))) {
    return NextResponse.json({ message: "Unsupported Pearl Admin route." }, { status: 404 });
  }

  const upstreamUrl = new URL(`${baseUrl}/${path}`);
  upstreamUrl.search = request.nextUrl.search;

  const headers = new Headers({
    Accept: "application/json",
    "x-admin-key": adminKey,
  });
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return NextResponse.json(
      { message: "The Pearl API is currently unreachable." },
      { status: 502 },
    );
  }

  return new NextResponse(await upstreamResponse.text(), {
    status: upstreamResponse.status,
    headers: {
      "Content-Type": upstreamResponse.headers.get("Content-Type") || "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyPearlRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyPearlRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyPearlRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyPearlRequest(request, context);
}
