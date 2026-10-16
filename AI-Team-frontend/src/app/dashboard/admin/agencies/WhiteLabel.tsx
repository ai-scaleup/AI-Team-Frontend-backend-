"use client";

import { useState } from "react";
import { Check, Copy, Globe, ImagePlus, KeyRound } from "lucide-react";
import { ErrorBox, InfoBox, Modal, inputCls, labelCls, primaryBtn, secondaryBtn } from "./AgencyDetail";
import type { AgencyBrandingSettings, AgencyClient } from "./agencyTypes";
import type { LoginLink } from "./agenciesApi";
import { agencyLoginPath } from "@/lib/agencyHost";

// White label pieces shared by the superadmin agency page and the agency
// portal: branding form, the agency's sign-in address, and setup links that
// let a customer set a password.
//
// The sign-in address is on the AI Team address itself, whichever one this
// page is open on (http://localhost:3002 locally, the live domain in
// production), under the agency's name: /<slug>.

const MAX_LOGO_BYTES = 200 * 1024;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

const origin = () => (typeof window !== "undefined" ? window.location.origin : "");

/** Where the agency's customers sign in. */
export const signInUrl = (slug: string) => `${origin()}${agencyLoginPath(slug)}`;

/** The link a customer opens to set their password. */
export const setupUrl = (slug: string, code: string) =>
  `${signInUrl(slug)}/setup?code=${encodeURIComponent(code)}`;

export function BrandingForm({
  branding, fallbackName, onSave, canEdit = true,
}: {
  branding: AgencyBrandingSettings | null | undefined;
  fallbackName: string;
  onSave: (input: AgencyBrandingSettings) => Promise<void>;
  canEdit?: boolean;
}) {
  const [productName, setProductName] = useState(branding?.productName ?? fallbackName);
  const [primaryColor, setPrimaryColor] = useState(branding?.primaryColor ?? "#0ea5e9");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(branding?.logoDataUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const validColor = /^#[0-9a-f]{6}$/i.test(primaryColor);

  const pickLogo = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) return setError("Use a PNG, JPEG, WebP or SVG image.");
    if (file.size > MAX_LOGO_BYTES) return setError("Keep the logo under 200 KB.");
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await onSave({ productName: productName.trim(), primaryColor, logoDataUrl });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save the branding.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Product name customers see</label>
            <input value={productName} onChange={(e) => setProductName(e.target.value)} maxLength={60} disabled={!canEdit} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Main colour</label>
            <div className="flex gap-2">
              <input type="color" value={validColor ? primaryColor : "#0ea5e9"} onChange={(e) => setPrimaryColor(e.target.value)} disabled={!canEdit} className="h-[46px] w-14 cursor-pointer rounded-xl border border-white/10 bg-white/5 p-1" />
              <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value.trim())} disabled={!canEdit} className={inputCls} />
            </div>
          </div>
        </div>
        <div>
          <label className={labelCls}>Logo (PNG, JPEG, WebP or SVG, under 200 KB)</label>
          <div className="flex flex-wrap items-center gap-3">
            <label className={`flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 transition ${canEdit ? "cursor-pointer hover:bg-white/5" : "opacity-40"}`}>
              <ImagePlus size={15} /> {logoDataUrl ? "Replace logo" : "Upload logo"}
              <input type="file" accept={LOGO_TYPES.join(",")} disabled={!canEdit} className="hidden" onChange={(e) => pickLogo(e.target.files?.[0])} />
            </label>
            {logoDataUrl && canEdit && (
              <button type="button" onClick={() => setLogoDataUrl(null)} className="text-xs text-white/40 transition hover:text-red-400">Remove logo</button>
            )}
          </div>
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
        {canEdit && (
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={busy || !productName.trim() || !validColor} className={`${primaryBtn} max-w-[200px]`}>
              {busy ? "Saving…" : "Save branding"}
            </button>
            {saved && <span className="flex items-center gap-1 text-xs text-emerald-400"><Check size={13} /> Saved</span>}
          </div>
        )}
      </div>

      {/* Preview of the customer's sign-in page */}
      <div className="rounded-2xl border border-white/10 bg-[#020617] p-5">
        <p className="mb-4 text-[10px] uppercase tracking-widest text-white/30">Customer sign-in preview</p>
        <div className="flex flex-col items-center gap-2 text-center">
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local data: URL preview
            <img src={logoDataUrl} alt="" className="h-10 max-w-[180px] object-contain" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold text-white" style={{ background: validColor ? primaryColor : "#0ea5e9" }}>
              {(productName.trim() || "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <p className="text-sm font-semibold">{productName.trim() || fallbackName}</p>
        </div>
        <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-[#0B1221] p-3">
          <div className="h-7 rounded-lg bg-white/5" />
          <div className="h-7 rounded-lg bg-white/5" />
          <div className="h-7 rounded-lg text-center text-[11px] font-semibold leading-7 text-white" style={{ background: validColor ? primaryColor : "#0ea5e9" }}>Sign in</div>
        </div>
      </div>
    </div>
  );
}

function CopyRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2">
      <code className="min-w-0 flex-1 truncate px-2 text-xs text-sky-200">{url}</code>
      <button onClick={copy} className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-sky-500/15 px-3 py-1.5 text-xs font-medium text-sky-300 transition hover:bg-sky-500/25">
        {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
      </button>
    </div>
  );
}

/** The agency's sign-in page on the AI Team address, ready to copy. */
export function SignInAddress({ slug }: { slug: string }) {
  return (
    <div className="space-y-2">
      <CopyRow url={signInUrl(slug)} />
      <p className="flex items-center gap-1.5 text-xs text-white/40">
        <Globe size={12} /> Customers sign in here with their email and a password, branded as above. No other domain is needed.
      </p>
    </div>
  );
}

export function LoginLinkModal({
  customer, slug, onCreate, onClose,
}: {
  customer: AgencyClient;
  slug: string;
  onCreate: () => Promise<LoginLink>;
  onClose: () => void;
}) {
  const [link, setLink] = useState<LoginLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      setLink(await onCreate());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create the link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Login link for ${customer.company}`} subtitle={customer.email} onClose={onClose} width="max-w-lg">
      <div className="space-y-4">
        {!link ? (
          <>
            <InfoBox>
              The customer opens this link, sets a password, and from then on signs in on the agency&apos;s sign-in page with
              their email and that password. The link works once, for 14 days. {customer.hasLogin
                ? "This customer already has a password: the link resets it and signs them out everywhere."
                : "Creating a new link cancels any earlier one."}
            </InfoBox>
            {error && <ErrorBox>{error}</ErrorBox>}
            <div className="flex gap-3">
              <button onClick={onClose} className={secondaryBtn}>Cancel</button>
              <button onClick={create} disabled={busy} className={`${primaryBtn} flex items-center justify-center gap-2`}>
                <KeyRound size={15} /> {busy ? "Creating…" : customer.hasLogin ? "Create reset link" : "Create setup link"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-white/60">
              Send this to {customer.company}. It is shown only now and works until{" "}
              {new Date(link.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.
            </p>
            <CopyRow url={setupUrl(slug, link.code)} />
            <p className="text-xs text-white/40">Afterwards they sign in at {signInUrl(slug)}</p>
            <button onClick={onClose} className={`${primaryBtn} w-full`}>Done</button>
          </>
        )}
      </div>
    </Modal>
  );
}
