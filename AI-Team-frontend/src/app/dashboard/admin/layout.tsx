"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Loader2,
  CreditCard,
  Users,
  LogOut,
  Lock,
  Mail,
  KeyRound,
  BookOpen
} from "lucide-react";
import { isAdminEmail } from "@/lib/adminAccess";

// Frontend-only admin gate credentials (no database involved)
const PANEL_CREDENTIALS: Record<string, string> = {
  "digitalcoachai@gmail.com": "Dca!2026#wQ5n",
  "luca.papa.digital@gmail.com": "Lcp@2026!hB8s",
  "natali@digital-coach.com": "Ntl!2026#vK9q",
  "giuseppe@digital-coach.com": "Gsp@2026!mR4x",
  "giuseppe.grimaldi.digitalcoach@gmail.com": "Grm#2026@pT7z",
};

const GATE_STORAGE_KEY = "admin_panel_gate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [gateChecked, setGateChecked] = useState(false);
  const [gateAuthed, setGateAuthed] = useState(false);
  const [gateEmail, setGateEmail] = useState("");
  const [gatePassword, setGatePassword] = useState("");
  const [gateError, setGateError] = useState("");

  useEffect(() => {
    setGateAuthed(sessionStorage.getItem(GATE_STORAGE_KEY) === "ok");
    setGateChecked(true);
  }, []);

  const handleGateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const email = gateEmail.trim().toLowerCase();
    if (isAdminEmail(email) && PANEL_CREDENTIALS[email] === gatePassword) {
      sessionStorage.setItem(GATE_STORAGE_KEY, "ok");
      setGateAuthed(true);
      setGateError("");
    } else {
      setGateError("Invalid email or password.");
    }
  };

  const handleExitAdmin = () => {
    sessionStorage.removeItem(GATE_STORAGE_KEY);
  };

  if (!gateChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617]">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!gateAuthed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1221] p-8">
          <div className="mb-6 flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10">
              <Lock className="h-7 w-7 text-sky-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Admin Access</h1>
            <p className="text-center text-sm text-white/50">
              Enter your admin email and password to continue.
            </p>
          </div>
          <form onSubmit={handleGateSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="Email"
                value={gateEmail}
                onChange={(e) => setGateEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/30 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="Password"
                value={gatePassword}
                onChange={(e) => setGatePassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/30 focus:border-sky-500 focus:outline-none"
              />
            </div>
            {gateError && (
              <p className="text-center text-sm text-red-400">{gateError}</p>
            )}
            <button
              type="submit"
              className="rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-500"
            >
              Enter Admin Panel
            </button>
            <Link
              href="/dashboard"
              className="text-center text-sm text-white/50 transition-colors hover:text-white"
            >
              Back to Dashboard
            </Link>
          </form>
        </div>
      </div>
    );
  }

  const navItems = [
    { name: "Agents & Teams", href: "/dashboard/admin/agents", icon: Bot },
    { name: "Assign & Memberships", href: "/dashboard/admin/assign", icon: CreditCard },
    { name: "Users", href: "/dashboard/admin/users", icon: Users },
    { name: "Knowledgebase", href: "/dashboard/admin/knowledgebase", icon: BookOpen },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#020617] text-white">
      {/* Sidebar */}
      <aside className="relative h-screen w-64 flex-shrink-0 border-r border-white/10 bg-[#0B1221]">
        <div className="flex h-16 items-center border-b border-white/10 px-6">
          <h1 className="text-lg font-bold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">AI Team Admin</h1>
        </div>
        <nav className="flex flex-col gap-2 p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-sky-500/10 text-sky-400"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-4 w-64 px-4">
          <Link
            href="/dashboard"
            onClick={handleExitAdmin}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white/60 transition-all hover:bg-white/5 hover:text-red-400"
          >
            <LogOut size={18} />
            Exit Admin
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="h-screen min-w-0 flex-1 overflow-y-auto custom-scrollbar">
        {children}
      </main>
    </div>
  );
}
