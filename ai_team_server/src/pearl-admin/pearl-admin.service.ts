import {
  BadGatewayException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

type PearlRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
};

type ListUsersQuery = {
  page?: string | number;
  limit?: string | number;
  search?: string;
  sortOrder?: 'asc' | 'desc';
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
  campaigns?: PearlCampaign[];
};

type PearlUsersPage = {
  data?: PearlUser[];
  meta?: { total?: number; totalPages?: number };
};

/** Upstream caps `limit` at 100, so the record list walks the user pages. */
const UPSTREAM_USER_PAGE_SIZE = 100;
const MAX_UPSTREAM_USER_PAGES = 20;

@Injectable()
export class PearlAdminService {
  async request(path: string, options: PearlRequestOptions = {}) {
    const adminKey = process.env.ADMIN_API_KEY;
    if (!adminKey) {
      throw new ServiceUnavailableException(
        'ADMIN_API_KEY is not configured on the server.',
      );
    }

    const baseUrl = process.env.PEARL_ADMIN_API_URL?.replace(/\/$/, '');
    if (!baseUrl) {
      throw new ServiceUnavailableException(
        'PEARL_ADMIN_API_URL is not configured on the server.',
      );
    }

    const url = new URL(`${baseUrl}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new BadGatewayException('The Pearl API is currently unreachable.');
    }

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { message: text };
      }
    }

    if (!response.ok) {
      throw new HttpException(
        payload ?? { message: 'Pearl API request failed.' },
        response.status,
      );
    }

    return payload;
  }

  /**
   * Users with their campaign records nested underneath. Sourced from
   * `GET /admin/users?includeCampaigns=true` because upstream
   * `GET /admin/user-data` answers 500 for every query. Searching matches the
   * user *and* their campaigns, so filtering, sorting and pagination are
   * applied here rather than upstream.
   */
  async listUsers(query: ListUsersQuery = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const search = (query.search ?? '').trim().toLowerCase();
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const users: PearlUser[] = [];
    let usersTotal = 0;

    for (
      let upstreamPage = 1;
      upstreamPage <= MAX_UPSTREAM_USER_PAGES;
      upstreamPage += 1
    ) {
      const payload = (await this.request('/admin/users', {
        query: {
          page: upstreamPage,
          limit: UPSTREAM_USER_PAGE_SIZE,
          includeCampaigns: true,
        },
      })) as PearlUsersPage;

      const batch = Array.isArray(payload?.data) ? payload.data : [];
      users.push(...batch);

      usersTotal = Number(payload?.meta?.total ?? users.length);
      const totalPages = Number(payload?.meta?.totalPages ?? 1);
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
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime(),
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

    const recordsTotal = normalized.reduce(
      (sum, user) => sum + user.campaignCount,
      0,
    );

    const filtered = search
      ? normalized.filter((user) =>
          [
            user.email,
            user.username,
            ...user.campaigns.flatMap((campaign) => [
              campaign.campaignName,
              campaign.outboundId,
            ]),
          ].some((value) => value?.toLowerCase().includes(search)),
        )
      : normalized;

    filtered.sort((a, b) => {
      const left = new Date(a.createdAt ?? 0).getTime();
      const right = new Date(b.createdAt ?? 0).getTime();
      return sortOrder === 'asc' ? left - right : right - left;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;

    return {
      data: filtered.slice(start, start + limit),
      meta: { total, page: safePage, limit, totalPages },
      usersTotal: Number.isFinite(usersTotal) ? usersTotal : 0,
      recordsTotal,
    };
  }
}
