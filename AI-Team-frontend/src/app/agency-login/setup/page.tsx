"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { agencyPrefix } from "@/lib/agencyHost";
import { useAgencyBranding } from "@/lib/session";
import AgencyAuthCard, { SubmitButton, fieldCls } from "../AgencyAuthCard";

const MIN_PASSWORD = 10;

// Opened from the one-time setup link an agency gives its customer:
// /agency-login/<agencyId>/setup?code=… (or /agency-login/setup?code=… on the
// agency's own address). Sets (or resets) the password and signs in.
function SetupForm() {
  const code = useSearchParams().get("code") ?? "";
  const branding = useAgencyBranding();
  const agencyId = branding?.agencyId;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords are different.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agency-auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyId, code, password }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        setError(payload?.error ?? "Could not set the password. Try again.");
        return;
      }
      window.location.href = `${branding ? agencyPrefix(branding) : ""}/dashboard`;
    } finally {
      setBusy(false);
    }
  };

  if (!code) {
    return (
      <AgencyAuthCard title="Set your password">
        <p className="text-sm text-white/60">This link is incomplete. Open the full link your provider sent you.</p>
      </AgencyAuthCard>
    );
  }

  return (
    <AgencyAuthCard title="Set your password" subtitle={`At least ${MIN_PASSWORD} characters. You will use it with your email to sign in.`}>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          className={fieldCls}
        />
        <input
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat the password"
          className={fieldCls}
        />
        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">{error}</p>}
        <SubmitButton busy={busy} label="Save and sign in" busyLabel="Saving…" />
      </form>
    </AgencyAuthCard>
  );
}

export default function AgencySetupPage() {
  return (
    <Suspense>
      <SetupForm />
    </Suspense>
  );
}
