"use client";

import { authenticatedFetch } from "@/lib/authenticatedFetch";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bot,
  BookOpen,
  ChevronRight,
  Database,
  Loader2,
  RefreshCw,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";
import PineconeDocuments from "@/app/dashboard/knowledgebase/_components/PineconeDocuments";
import { KB_AGENTS, KB_SHARED_AGENTS } from "@/app/dashboard/knowledgebase/_lib/kbData";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const ADMIN_KB_ENDPOINT = "/api/admin/knowledgebase/pinecone";

type KnowledgebaseUser = {
  id: string;
  oauthId: string;
  email: string;
  username?: string | null;
};

type UsersResponse = {
  data?: KnowledgebaseUser[];
  meta?: {
    page: number;
    total: number;
    totalPages: number;
  };
};

type KnowledgeTarget = {
  key: string;
  name: string;
  role: string;
  global?: boolean;
};

const KNOWLEDGE_TARGETS: KnowledgeTarget[] = [
  { key: "shared", name: "Shared knowledge", role: "Available to all of this user's agents" },
  ...KB_SHARED_AGENTS.map((agent) => ({ ...agent, global: true })),
  ...KB_AGENTS,
];

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json();
    return typeof data?.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function userSearchText(user: KnowledgebaseUser): string {
  return normalizeSearchValue([user.email, user.username ?? "", user.oauthId].join(" "));
}

function emailMatchRank(user: KnowledgebaseUser, query: string): number {
  const email = normalizeSearchValue(user.email);
  const name = normalizeSearchValue(user.username ?? "");
  const oauthId = normalizeSearchValue(user.oauthId);
  const localPart = email.split("@")[0];

  if (email === query) return 0;
  if (email.startsWith(query)) return 1;
  if (localPart.startsWith(query)) return 2;
  if (name.startsWith(query)) return 3;
  if (email.includes(query)) return 4;
  if (name.includes(query)) return 5;
  if (oauthId.includes(query)) return 6;
  return 7;
}

export default function AdminKnowledgebasePage() {
  const [users, setUsers] = useState<KnowledgebaseUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<KnowledgebaseUser | null>(null);
  const [activeTarget, setActiveTarget] = useState("shared");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadUsers = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    const fetchAllUsers = async () => {
      setLoading(true);
      setError(null);

      try {
        const firstResponse = await authenticatedFetch(
          `${API_BASE}/users?page=1&limit=100&sortBy=createdAt&sortDir=desc`,
          { signal: controller.signal },
        );
        if (!firstResponse.ok) {
          throw new Error(await readApiError(firstResponse, `Failed to load users (${firstResponse.status})`));
        }

        const firstPage = (await firstResponse.json()) as UsersResponse;
        const totalPages = Math.max(firstPage.meta?.totalPages ?? 1, 1);
        const remainingRequests = Array.from({ length: totalPages - 1 }, (_, index) =>
          authenticatedFetch(
            `${API_BASE}/users?page=${index + 2}&limit=100&sortBy=createdAt&sortDir=desc`,
            { signal: controller.signal },
          ).then(async (response) => {
            if (!response.ok) {
              throw new Error(await readApiError(response, `Failed to load users (${response.status})`));
            }
            return (await response.json()) as UsersResponse;
          }),
        );
        const remainingPages = await Promise.all(remainingRequests);
        const allUsers = [
          ...(Array.isArray(firstPage.data) ? firstPage.data : []),
          ...remainingPages.flatMap((page) => (Array.isArray(page.data) ? page.data : [])),
        ];

        setUsers(allUsers.filter((user) => user.email && user.oauthId));
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError(loadError instanceof Error ? loadError.message : "Failed to load users");
          setUsers([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchAllUsers();
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    if (!selectedUser) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedUser(null);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [selectedUser]);

  const visibleUsers = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery) return users;
    const terms = normalizedQuery.split(/\s+/).filter(Boolean);

    return users
      .filter((user) => {
        const searchable = userSearchText(user);
        return terms.every((term) => searchable.includes(term));
      })
      .sort((left, right) => {
        const rankDifference = emailMatchRank(left, normalizedQuery) - emailMatchRank(right, normalizedQuery);
        return rankDifference || left.email.localeCompare(right.email);
      });
  }, [query, users]);

  const hasSearch = query.trim().length > 0;

  const selectedTarget = KNOWLEDGE_TARGETS.find((target) => target.key === activeTarget) ?? KNOWLEDGE_TARGETS[0];
  const agentKey = activeTarget === "shared" ? undefined : activeTarget;
  const usesGlobalIndex = Boolean(selectedTarget.global);
  const namespace = selectedUser
    ? activeTarget === "shared"
      ? selectedUser.oauthId
      : usesGlobalIndex
        ? ""
        : `${selectedUser.oauthId}-${activeTarget}`
    : "";

  const openUser = (user: KnowledgebaseUser) => {
    setActiveTarget("shared");
    setSelectedUser(user);
  };

  return (
    <div className="min-h-full p-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sky-400">
            <BookOpen size={20} />
            <span className="text-xs font-semibold uppercase tracking-[0.16em]">Admin control</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Knowledgebase</h1>
          <p className="mt-1 text-sm text-white/50">
            Upload and delete files in every user&apos;s shared and agent knowledge bases.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3">
          <Users size={18} className="text-sky-400" />
          <div>
            <p className="text-lg font-bold leading-none text-white">
              {hasSearch ? visibleUsers.length : users.length}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-white/40">
              {hasSearch ? `Matches of ${users.length}` : "Users loaded"}
            </p>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0F172A]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
          <div className="relative min-w-[260px] flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" size={16} />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by email, name, or user ID..."
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-10 text-sm text-white outline-none placeholder:text-white/30 focus:border-sky-500"
            />
            {hasSearch && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear user search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/35 transition hover:bg-white/10 hover:text-white"
              >
                <X size={15} />
              </button>
            )}
          </div>
          {hasSearch && (
            <span className="text-xs font-medium text-sky-400">
              {visibleUsers.length} {visibleUsers.length === 1 ? "match" : "matches"}
            </span>
          )}
          <button
            onClick={loadUsers}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-white/60 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="divide-y divide-white/5">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-white/45">
              <Loader2 size={18} className="animate-spin" /> Loading all users...
            </div>
          )}

          {!loading && error && (
            <div className="m-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Couldn&apos;t load users</p>
                <p className="mt-1 text-xs text-red-200/70">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && visibleUsers.length === 0 && (
            <div className="py-16 text-center text-sm text-white/40">
              {users.length === 0 ? "No users are available." : "No users match your search."}
            </div>
          )}

          {!loading && !error && visibleUsers.map((user) => (
            <button
              key={user.id}
              onClick={() => openUser(user)}
              className="group flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-white/[0.035]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
                <UserRound size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white group-hover:text-sky-300">{user.email}</p>
                <p className="mt-1 truncate text-xs text-white/35">
                  {user.username || "No display name"} · {user.oauthId}
                </p>
              </div>
              <span className="hidden text-xs font-medium text-white/35 group-hover:text-sky-400 sm:block">
                Manage files
              </span>
              <ChevronRight size={17} className="shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-sky-400" />
            </button>
          ))}
        </div>
      </section>

      {selectedUser && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setSelectedUser(null);
          }}
        >
          <aside className="ml-auto flex h-full w-full max-w-[980px] flex-col border-l border-white/10 bg-[#08101F] shadow-2xl shadow-black/60">
            <div className="flex items-start gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
                <UserRound size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wider text-white/35">Manage user knowledge</p>
                <h2 className="mt-1 truncate text-lg font-bold text-white">{selectedUser.email}</h2>
                <p className="mt-0.5 truncate font-mono text-xs text-white/35">{selectedUser.oauthId}</p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                aria-label="Close knowledgebase manager"
                className="rounded-lg p-2 text-white/45 transition hover:bg-white/10 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 md:grid-cols-[260px_minmax(0,1fr)]">
              <nav className="overflow-y-auto border-b border-white/10 p-3 custom-scrollbar md:border-b-0 md:border-r">
                <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">
                  Knowledge bases
                </p>
                <div className="space-y-1">
                  {KNOWLEDGE_TARGETS.map((target) => {
                    const isActive = target.key === activeTarget;
                    return (
                      <button
                        key={target.key}
                        onClick={() => setActiveTarget(target.key)}
                        className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                          isActive
                            ? "bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/20"
                            : "text-white/55 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {target.key === "shared" ? (
                          <Database size={16} className="mt-0.5 shrink-0" />
                        ) : (
                          <Bot size={16} className="mt-0.5 shrink-0" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{target.name}</span>
                          {target.global && (
                            <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-amber-400/80">
                              Global index
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </nav>

              <div className="min-w-0 overflow-y-auto p-4 custom-scrollbar sm:p-6">
                <div className="mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{selectedTarget.name}</h3>
                    {usesGlobalIndex && (
                      <span className="rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                        Shared across users
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-white/45">
                    {selectedTarget.role}
                  </p>
                  {usesGlobalIndex && (
                    <p className="mt-2 rounded-xl border border-amber-500/15 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-amber-200/70">
                      This agent uses a dedicated global Pinecone index. Changes here affect the agent for every user.
                    </p>
                  )}
                </div>

                <PineconeDocuments
                  key={`${selectedUser.oauthId}:${activeTarget}`}
                  namespace={namespace}
                  agentKey={agentKey}
                  useDefaultNamespace={usesGlobalIndex}
                  isDark
                  apiEndpoint={ADMIN_KB_ENDPOINT}
                  adminTargetUserId={selectedUser.oauthId}
                />
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
