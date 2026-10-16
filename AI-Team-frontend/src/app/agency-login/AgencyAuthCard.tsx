"use client";

import type { ReactNode } from "react";
import { useAgencyBranding } from "@/lib/session";

/** The branded frame around the agency login and setup forms. */
export default function AgencyAuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const branding = useAgencyBranding();

  if (!branding) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-4 text-white">
        <p className="text-sm text-white/50">This sign-in link is not valid. Ask your provider for a new one.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#020617] px-4 py-10 text-white">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          {branding.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL from the agency's branding
            <img src={branding.logoDataUrl} alt={branding.productName} className="h-14 max-w-[220px] object-contain" />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold text-white"
              style={{ background: branding.primaryColor }}
            >
              {branding.productName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <p className="text-lg font-semibold">{branding.productName}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0B1221] p-6 shadow-2xl shadow-black/40">
          <h1 className="text-lg font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-white/50">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        {branding.suspended && (
          <p className="mt-4 text-center text-xs text-amber-300">This service is paused. Please contact your provider.</p>
        )}
      </div>
    </main>
  );
}

export const fieldCls =
  "w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30";

export function SubmitButton({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
  const branding = useAgencyBranding();
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      style={{ background: branding?.primaryColor ?? "#0ea5e9" }}
    >
      {busy ? busyLabel : label}
    </button>
  );
}
