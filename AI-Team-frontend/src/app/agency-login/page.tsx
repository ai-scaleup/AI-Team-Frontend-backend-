"use client";

import { useState } from "react";
import { agencyPrefix } from "@/lib/agencyHost";
import { useAgencyBranding } from "@/lib/session";
import AgencyAuthCard, { SubmitButton, fieldCls } from "./AgencyAuthCard";

const MIN_PASSWORD = 10;

// An agency's sign-in page: /<agency-name> on the AI Team address,
// or "/" on the agency's own address (middleware serves it there). A customer
// the agency has added can also create their account here the first time.
export default function AgencyLoginPage() {
  const branding = useAgencyBranding();
  const agencyId = branding?.agencyId;
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signUp = mode === "sign-up";

  const switchMode = () => {
    setMode(signUp ? "sign-in" : "sign-up");
    setConfirm("");
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signUp && password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (signUp && password !== confirm) {
      setError("The two passwords are different.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(signUp ? "/api/agency-auth/sign-up" : "/api/agency-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyId, email: email.trim(), password }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        setError(payload?.error ?? (signUp ? "Could not create the account. Try again." : "Sign-in failed. Try again."));
        return;
      }
      window.location.href = `${branding ? agencyPrefix(branding) : ""}/dashboard`;
    } finally {
      setBusy(false);
    }
  };

  return (
    <AgencyAuthCard
      title={signUp ? "Create your account" : "Sign in"}
      subtitle={
        signUp
          ? `Use the email your provider added, and choose a password of at least ${MIN_PASSWORD} characters.`
          : "Use your email and password."
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className={fieldCls}
        />
        <input
          type="password"
          autoComplete={signUp ? "new-password" : "current-password"}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={signUp ? "Choose a password" : "Password"}
          className={fieldCls}
        />
        {signUp && (
          <input
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat the password"
            className={fieldCls}
          />
        )}
        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">{error}</p>}
        <SubmitButton
          busy={busy}
          label={signUp ? "Create account" : "Sign in"}
          busyLabel={signUp ? "Creating…" : "Signing in…"}
        />
      </form>
      <p className="mt-4 text-center text-xs text-white/50">
        {signUp ? "Already have an account? " : "First time here? "}
        <button type="button" onClick={switchMode} className="font-semibold text-white underline-offset-2 hover:underline">
          {signUp ? "Sign in" : "Create an account"}
        </button>
      </p>
      {!signUp && (
        <p className="mt-2 text-center text-xs text-white/40">Forgot your password? Ask your provider for a reset link.</p>
      )}
    </AgencyAuthCard>
  );
}
