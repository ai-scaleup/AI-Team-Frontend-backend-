"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  ShieldAlert,
  Loader2,
  CreditCard,
  Users,
  LogOut
} from "lucide-react";

const ADMIN_EMAILS = [
  "digitalcoachai@gmail.com",
  "luca.papa.digital@gmail.com",
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();
  const email = user?.primaryEmailAddress?.emailAddress;
  const isAdmin = !!email && ADMIN_EMAILS.includes(email);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617]">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#020617]">
        <ShieldAlert className="h-16 w-16 text-red-500" />
        <h1 className="text-2xl font-bold text-white">Access Denied</h1>
        <p className="text-sm text-white/50">This panel is restricted to administrators.</p>
        <Link href="/dashboard" className="mt-2 rounded-xl bg-sky-600 px-5 py-2 font-semibold text-white transition-colors hover:bg-sky-500">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const navItems = [
    { name: "Agents & Teams", href: "/dashboard/admin/agents", icon: Bot },
    { name: "Assign & Memberships", href: "/dashboard/admin/assign", icon: CreditCard },
    { name: "Users", href: "/dashboard/admin/users", icon: Users },
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
