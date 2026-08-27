"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { getDevUserEmail } from "@/lib/devToken"

const API_BASE = "/api/pearl-admin";
const PAGE_SIZE = 10;

type PearlRecord = {
  id: string;
  userId?: string;
  campaignName?: string;
  outboundId?: string;
  createdAt?: string;
  updatedAt?: string;
};

type PearlUser = {
  id: string;
  email?: string;
  username?: string;
  createdAt?: string;
  updatedAt?: string;
  campaignCount: number;
  campaigns: PearlRecord[];
};

type UsersResult = {
  users: PearlUser[];
  total: number;
  totalPages: number;
  usersTotal: number;
  recordsTotal: number;
};

type EditorState =
  | { mode: "create"; user?: PearlUser; record?: undefined }
  | { mode: "edit"; user: PearlUser; record: PearlRecord };

type DeleteTarget = { user: PearlUser; record: PearlRecord };

type FormState = {
  email: string;
  campaignName: string;
  outboundId: string;
  bearerToken: string;
};

type ToastState = { tone: "success" | "error"; message: string } | null;

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const emptyForm: FormState = {
  email: "",
  campaignName: "",
  outboundId: "",
  bearerToken: "",
};

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#091225] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/5";

function readMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(", ");
  }
  return fallback;
}

function normalizeUsers(payload: unknown, fallbackPage: number): UsersResult {
  const root = (payload ?? {}) as Record<string, unknown>;
  const meta = (root.meta ?? {}) as Record<string, unknown>;
  const users = (Array.isArray(root.data) ? root.data : []) as PearlUser[];
  const total = Number(meta.total ?? users.length);
  const totalPages = Number(meta.totalPages ?? Math.max(1, Math.ceil(total / PAGE_SIZE)));

  return {
    users: users.map((user) => ({
      ...user,
      campaigns: Array.isArray(user.campaigns) ? user.campaigns : [],
      campaignCount: Number(user.campaignCount ?? user.campaigns?.length ?? 0),
    })),
    total: Number.isFinite(total) ? total : users.length,
    totalPages: Number.isFinite(totalPages) ? Math.max(1, totalPages) : Math.max(1, fallbackPage),
    usersTotal: Number(root.usersTotal ?? total) || 0,
    recordsTotal: Number(root.recordsTotal ?? 0) || 0,
  };
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function userLabel(user?: PearlUser) {
  return user?.email ?? user?.username ?? "Unknown user";
}

function userInitials(user: PearlUser) {
  return userLabel(user).slice(0, 2).toUpperCase();
}

export default function PearlAdminPage() {
  const { user, isLoaded: authLoaded, isSignedIn } = useUser();
  const [users, setUsers] = useState<PearlUser[]>([]);
  const [matchingUsers, setMatchingUsers] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [authenticationError, setAuthenticationError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const request = useCallback(
    async (path: string, init?: RequestInit) => {
      const response = await fetch(`${API_BASE}${path}`, {
        ...init,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...init?.headers,
        },
      });

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
        throw new ApiError(readMessage(payload, response.statusText || "Request failed."), response.status);
      }

      return payload;
    },
    [],
  );

  const loadUsers = useCallback(
    async (quiet = false) => {
      if (!quiet) setIsLoading(true);
      setLoadError("");

      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        sortOrder,
      });
      if (searchTerm) params.set("search", searchTerm);

      try {
        const payload = await request(`/users?${params.toString()}`);
        const result = normalizeUsers(payload, page);
        setUsers(result.users);
        setMatchingUsers(result.total);
        setTotalPages(result.totalPages);
        setTotalUsers(result.usersTotal);
        setTotalRecords(result.recordsTotal);
        setAccessDenied(false);
        setAuthenticationError("");
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          setAccessDenied(true);
          setAuthenticationError("");
        } else if (error instanceof ApiError && error.status === 401) {
          setAccessDenied(false);
          setAuthenticationError(error.message);
        } else {
          setLoadError(error instanceof Error ? error.message : "Unable to load Pearl users.");
        }
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    },
    [page, request, searchTerm, sortOrder],
  );

  useEffect(() => {
    if (!authLoaded || !isSignedIn) return;
    void loadUsers();
  }, [authLoaded, isSignedIn, loadUsers]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const selectedUser = useMemo(
    () => users.find((candidate) => candidate.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  const recordsOnPage = useMemo(
    () => users.reduce((sum, candidate) => sum + candidate.campaignCount, 0),
    [users],
  );

  // Escape closes the topmost layer: dialogs first, then the side panel.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (deleteTarget) setDeleteTarget(null);
      else if (editor) setEditor(null);
      else if (selectedUserId) setSelectedUserId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteTarget, editor, selectedUserId]);

  const openCreate = (target?: PearlUser) => {
    setForm({ ...emptyForm, email: target?.email ?? "" });
    setShowToken(false);
    setEditor({ mode: "create", user: target });
  };

  const openEdit = (target: PearlUser, record: PearlRecord) => {
    setForm({
      email: userLabel(target),
      campaignName: record.campaignName ?? "",
      outboundId: record.outboundId ?? "",
      bearerToken: "",
    });
    setShowToken(false);
    setEditor({ mode: "edit", user: target, record });
  };

  const refreshAll = async () => {
    setIsRefreshing(true);
    await loadUsers(true);
    setIsRefreshing(false);
  };

  const applySearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSelectedUserId(null);
    setSearchTerm(searchInput.trim());
  };

  const submitEditor = async (event: FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    setIsSaving(true);

    try {
      if (editor.mode === "create") {
        await request("/admin/user-data/by-email", {
          method: "POST",
          body: JSON.stringify({
            email: form.email.trim(),
            campaignName: form.campaignName.trim(),
            outboundId: form.outboundId.trim(),
            bearerToken: form.bearerToken.trim(),
          }),
        });
        setToast({ tone: "success", message: "Pearl user data created successfully." });
      } else {
        const body: Record<string, string> = {
          campaignName: form.campaignName.trim(),
          outboundId: form.outboundId.trim(),
        };
        if (form.bearerToken.trim()) body.bearerToken = form.bearerToken.trim();
        await request(`/admin/user-data/${encodeURIComponent(editor.record.id)}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setToast({ tone: "success", message: "Pearl user data updated successfully." });
      }

      setEditor(null);
      await refreshAll();
    } catch (error) {
      setToast({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to save this record.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await request(`/admin/user-data/${encodeURIComponent(deleteTarget.record.id)}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      setToast({ tone: "success", message: "Pearl user data deleted." });
      await refreshAll();
    } catch (error) {
      setToast({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to delete this record.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!authLoaded || (isLoading && !accessDenied && !authenticationError)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030712] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/5">
            <Database className="h-7 w-7 text-cyan-300" />
            <Loader2 className="absolute h-16 w-16 animate-spin text-cyan-400/30" />
          </div>
          <p className="text-sm text-slate-400">Opening Pearl Admin…</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn || accessDenied || authenticationError) {
    const isAuthenticationFailure = !isSignedIn || Boolean(authenticationError);
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030712] px-5 text-white">
        <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#091225] p-8 text-center shadow-2xl shadow-black/40">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10">
            <ShieldCheck className="h-8 w-8 text-amber-300" />
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-amber-300">
            {isAuthenticationFailure ? "Authentication required" : "Restricted agent"}
          </p>
          <h1 className="text-2xl font-semibold">
            {isAuthenticationFailure ? "Pearl Admin could not verify your session" : "Pearl Admin is not assigned"}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
            {isAuthenticationFailure ? (
              authenticationError || "Please sign in again, then reopen Pearl Admin."
            ) : (
              <>Ask an AI Team administrator to assign <span className="font-medium text-white">PEARL_ADMIN</span> to your account.</>
            )}
          </p>
          <Link href="/dashboard" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100">
            <ArrowLeft className="h-4 w-4" /> Back to AI Team
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_16%_0%,rgba(34,211,238,0.10),transparent_30%),radial-gradient(circle_at_90%_8%,rgba(99,102,241,0.12),transparent_28%)]" />
      <div className="relative mx-auto max-w-[1560px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-5 rounded-3xl border border-white/10 bg-[#07101f]/90 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" aria-label="Back to dashboard" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:border-cyan-300/40 hover:text-cyan-200">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-indigo-500 text-slate-950 shadow-lg shadow-cyan-500/20">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Pearl Admin</h1>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">Secure</span>
              </div>
              <p className="mt-1 text-sm text-slate-400">User data and campaign credential management</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="text-xs text-slate-500">Signed in as</p>
              <p className="max-w-52 truncate text-sm text-slate-300">{user?.primaryEmailAddress?.emailAddress || getDevUserEmail() || "developer"}</p>
            </div>
            <a href="https://pearl-whitelabel-monorepo.onrender.com/docs#/Admin%20-%20User%20Data%20Management" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white">
              API docs <ExternalLink className="h-4 w-4" />
            </a>
            <button onClick={() => openCreate()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110">
              <Plus className="h-4 w-4" /> New record
            </button>
          </div>
        </header>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total users", value: totalUsers.toLocaleString(), icon: Users, color: "text-cyan-300", bg: "bg-cyan-400/10" },
            { label: "Credential records", value: totalRecords.toLocaleString(), icon: Database, color: "text-indigo-300", bg: "bg-indigo-400/10" },
            { label: "Records on page", value: recordsOnPage.toLocaleString(), icon: KeyRound, color: "text-violet-300", bg: "bg-violet-400/10" },
            { label: "Connection", value: loadError ? "Attention" : "Protected", icon: ShieldCheck, color: loadError ? "text-amber-300" : "text-emerald-300", bg: loadError ? "bg-amber-400/10" : "bg-emerald-400/10" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-[#07101f]/80 p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{stat.label}</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight">{stat.value}</p>
                  </div>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.bg}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#07101f]/90 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="flex flex-col gap-4 border-b border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-300" />
                <h2 className="font-semibold">Pearl users</h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">Select a user to review and manage their campaign credentials.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <form onSubmit={applySearch} className="relative min-w-0 sm:w-80">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search email or campaign…" className="h-10 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-20 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40" />
                <button type="submit" className="absolute right-1.5 top-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/15">Search</button>
              </form>
              <select value={sortOrder} onChange={(event) => { setPage(1); setSortOrder(event.target.value as "asc" | "desc"); }} className="h-10 rounded-xl border border-white/10 bg-[#0b1528] px-3 text-sm text-slate-300 outline-none focus:border-cyan-300/40">
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>
              <button onClick={() => void refreshAll()} disabled={isRefreshing} aria-label="Refresh data" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {loadError ? (
            <div className="m-5 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
              <div className="flex-1"><p className="font-medium">Pearl data could not be loaded</p><p className="mt-1 text-amber-100/70">{loadError}</p></div>
              <button onClick={() => void refreshAll()} className="rounded-lg border border-amber-200/20 px-3 py-1.5 text-xs font-semibold hover:bg-amber-200/10">Retry</button>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/5"><Users className="h-7 w-7 text-cyan-300/70" /></div>
              <h3 className="font-semibold">No matching users</h3>
              <p className="mt-2 max-w-sm text-sm text-slate-500">{searchTerm ? "Try a different email or campaign name, or clear your search." : "Pearl has not registered any users yet."}</p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left">
                  <thead className="border-b border-white/10 bg-white/[0.025] text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    <tr><th className="px-6 py-4 font-medium">User</th><th className="px-6 py-4 font-medium">Campaigns</th><th className="px-6 py-4 font-medium">Latest campaign</th><th className="px-6 py-4 font-medium">Joined</th><th className="px-6 py-4 text-right font-medium">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.07]">
                    {users.map((candidate) => {
                      const latest = candidate.campaigns[0];
                      const isSelected = candidate.id === selectedUserId;
                      return (
                        <tr
                          key={candidate.id}
                          onClick={() => setSelectedUserId(candidate.id)}
                          className={`group cursor-pointer transition ${isSelected ? "bg-cyan-400/[0.06]" : "hover:bg-white/[0.025]"}`}
                        >
                          <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/20 to-indigo-400/20 text-xs font-bold text-cyan-200">{userInitials(candidate)}</div><div><p className="max-w-64 truncate text-sm font-medium text-slate-200">{userLabel(candidate)}</p><p className="mt-0.5 max-w-40 truncate font-mono text-[10px] text-slate-600">{candidate.id}</p></div></div></td>
                          <td className="px-6 py-4">
                            {candidate.campaignCount > 0 ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300/15 bg-indigo-300/10 px-2.5 py-1 text-xs font-medium text-indigo-200"><KeyRound className="h-3 w-3" />{candidate.campaignCount} {candidate.campaignCount === 1 ? "record" : "records"}</span>
                            ) : (
                              <span className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-500">No records</span>
                            )}
                          </td>
                          <td className="px-6 py-4"><p className="max-w-64 truncate text-xs text-slate-400">{latest?.campaignName ?? "—"}</p>{latest?.outboundId && <p className="mt-0.5 max-w-64 truncate font-mono text-[10px] text-slate-600">{latest.outboundId}</p>}</td>
                          <td className="px-6 py-4 text-xs text-slate-500">{formatDate(candidate.createdAt)}</td>
                          <td className="px-6 py-4"><div className="flex items-center justify-end gap-2"><span className="text-xs font-medium text-slate-500 transition group-hover:text-cyan-200">View campaigns</span><ChevronRight className="h-4 w-4 text-slate-600 transition group-hover:text-cyan-200" /></div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-white/[0.07] md:hidden">
                {users.map((candidate) => (
                  <button key={candidate.id} onClick={() => setSelectedUserId(candidate.id)} className="flex w-full items-center gap-3 p-5 text-left transition hover:bg-white/[0.025]">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/20 to-indigo-400/20 text-xs font-bold text-cyan-200">{userInitials(candidate)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-200">{userLabel(candidate)}</p>
                      <p className="mt-1 text-xs text-slate-500">{candidate.campaignCount} {candidate.campaignCount === 1 ? "record" : "records"} · joined {formatDate(candidate.createdAt)}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="flex flex-col gap-3 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">Showing {users.length} of {matchingUsers.toLocaleString()} users</p>
            <div className="flex items-center gap-2"><button onClick={() => { setSelectedUserId(null); setPage((current) => Math.max(1, current - 1)); }} disabled={page <= 1} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button><span className="min-w-24 text-center text-xs text-slate-400">Page <span className="font-semibold text-white">{page}</span> of {totalPages}</span><button onClick={() => { setSelectedUserId(null); setPage((current) => Math.min(totalPages, current + 1)); }} disabled={page >= totalPages} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button></div>
          </div>
        </section>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 z-[90] flex justify-end" role="dialog" aria-modal="true" aria-label={`Campaigns for ${userLabel(selectedUser)}`}>
          <button aria-label="Close panel" onClick={() => setSelectedUserId(null)} className="absolute inset-0 cursor-default bg-slate-950/70 backdrop-blur-sm" />
          <aside className="relative flex h-full w-full max-w-xl flex-col border-l border-white/10 bg-[#07101f] shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-indigo-400/20 text-sm font-bold text-cyan-200">{userInitials(selectedUser)}</div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Pearl user</p>
                  <h2 className="mt-1 truncate text-lg font-semibold">{userLabel(selectedUser)}</h2>
                  <p className="mt-1 truncate font-mono text-[10px] text-slate-600">{selectedUser.id}</p>
                </div>
              </div>
              <button onClick={() => setSelectedUserId(null)} aria-label="Close panel" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
              <div>
                <p className="text-sm font-medium text-slate-200">{selectedUser.campaignCount} {selectedUser.campaignCount === 1 ? "campaign record" : "campaign records"}</p>
                <p className="mt-0.5 text-xs text-slate-500">Joined {formatDate(selectedUser.createdAt)}</p>
              </div>
              <button onClick={() => openCreate(selectedUser)} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110">
                <Plus className="h-4 w-4" /> Add record
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {selectedUser.campaigns.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-5 py-14 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/5"><Database className="h-6 w-6 text-cyan-300/70" /></div>
                  <h3 className="font-semibold">No campaign records yet</h3>
                  <p className="mt-2 max-w-xs text-sm text-slate-500">Add the first Pearl campaign credential for this user.</p>
                  <button onClick={() => openCreate(selectedUser)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-100"><Plus className="h-4 w-4" /> Add record</button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {selectedUser.campaigns.map((record) => (
                    <li key={record.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="inline-flex max-w-full rounded-lg border border-indigo-300/15 bg-indigo-300/10 px-2.5 py-1 text-xs font-medium text-indigo-200"><span className="truncate">{record.campaignName ?? "Untitled"}</span></span>
                          <p className="mt-3 font-mono text-xs text-slate-400">{record.outboundId ?? "No outbound ID"}</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button onClick={() => openEdit(selectedUser, record)} aria-label={`Edit ${record.campaignName ?? "record"}`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-cyan-200"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => setDeleteTarget({ user: selectedUser, record })} aria-label={`Delete ${record.campaignName ?? "record"}`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-rose-300/30 hover:bg-rose-300/10 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/[0.07] pt-3 text-[11px] text-slate-600">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/5 bg-black/20 px-2 py-1 font-mono text-slate-500"><KeyRound className="h-3 w-3" /> ••••••••••••</span>
                        <span>Created {formatDate(record.createdAt)}</span>
                        <span>Updated {formatDate(record.updatedAt ?? record.createdAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}

      {editor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#091225] shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between border-b border-white/10 p-6"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{editor.mode === "create" ? "New credential" : "Edit credential"}</p><h2 className="mt-1 text-xl font-semibold">{editor.mode === "create" ? "Create Pearl user data" : form.campaignName || "Update record"}</h2><p className="mt-2 text-sm text-slate-500">{editor.mode === "create" ? (editor.user ? `The record is added to ${userLabel(editor.user)}.` : "The email must already exist in Pearl.") : "Leave the token blank to keep the current value."}</p></div><button onClick={() => setEditor(null)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-white"><X className="h-5 w-5" /></button></div>
            <form onSubmit={submitEditor} className="space-y-5 p-6">
              <div><label className="mb-2 block text-xs font-medium text-slate-400">User email</label><input type="email" required disabled={editor.mode === "edit" || Boolean(editor.user)} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="user@example.com" className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`} /></div>
              <div className="grid gap-5 sm:grid-cols-2"><div><label className="mb-2 block text-xs font-medium text-slate-400">Campaign name</label><input required value={form.campaignName} onChange={(event) => setForm((current) => ({ ...current, campaignName: event.target.value }))} placeholder="Sales campaign" className={inputClass} /></div><div><label className="mb-2 block text-xs font-medium text-slate-400">Outbound ID</label><input required value={form.outboundId} onChange={(event) => setForm((current) => ({ ...current, outboundId: event.target.value }))} placeholder="outbound_12345" className={inputClass} /></div></div>
              <div><label className="mb-2 block text-xs font-medium text-slate-400">Bearer token {editor.mode === "edit" && <span className="text-slate-600">(optional)</span>}</label><div className="relative"><input type={showToken ? "text" : "password"} required={editor.mode === "create"} autoComplete="off" value={form.bearerToken} onChange={(event) => setForm((current) => ({ ...current, bearerToken: event.target.value }))} placeholder={editor.mode === "create" ? "Paste campaign bearer token" : "Enter only to replace the token"} className={`${inputClass} pr-12`} /><button type="button" onClick={() => setShowToken((current) => !current)} aria-label={showToken ? "Hide token" : "Show token"} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">{showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
              <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={() => setEditor(null)} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white">Cancel</button><button type="submit" disabled={isSaving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-60">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{editor.mode === "create" ? "Create record" : "Save changes"}</button></div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true">
          <div className="w-full max-w-md rounded-3xl border border-rose-300/15 bg-[#091225] p-6 shadow-2xl shadow-black/60"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-400/10"><AlertTriangle className="h-6 w-6 text-rose-300" /></div><h2 className="mt-5 text-xl font-semibold">Delete this credential?</h2><p className="mt-2 text-sm leading-6 text-slate-400">This permanently removes <span className="font-medium text-white">{deleteTarget.record.campaignName ?? "this record"}</span> from <span className="font-medium text-white">{userLabel(deleteTarget.user)}</span> in Pearl. This action only runs after you confirm.</p><div className="mt-6 flex justify-end gap-3"><button onClick={() => setDeleteTarget(null)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white">Cancel</button><button onClick={() => void confirmDelete()} disabled={isDeleting} className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-60">{isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete record</button></div></div>
        </div>
      )}

      {toast && <div className={`fixed right-4 top-4 z-[120] flex max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl ${toast.tone === "success" ? "border-emerald-300/20 bg-emerald-950/90 text-emerald-100" : "border-rose-300/20 bg-rose-950/90 text-rose-100"}`}>{toast.tone === "success" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />}<p className="leading-5">{toast.message}</p><button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100"><X className="h-4 w-4" /></button></div>}
    </div>
  );
}
