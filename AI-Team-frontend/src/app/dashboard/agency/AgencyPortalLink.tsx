"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { fetchMyAgencies } from "./agencyPortalApi";

/** Top-bar link to the agency portal, shown only to agency staff. */
export default function AgencyPortalLink({ theme }: { theme: "dark" | "light" | string }) {
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMyAgencies()
      .then((list) => { if (!cancelled) setIsStaff(list.some((a) => !a.viaAdmin)); })
      .catch(() => { /* not staff, or signed out — no link */ });
    return () => { cancelled = true; };
  }, []);

  if (!isStaff) return null;
  return (
    <Link
      href="/dashboard/agency"
      className={`p-2 transition-colors ${theme === "dark" ? "text-white/80 hover:text-white" : "text-gray-600 hover:text-gray-900"}`}
      title="Agency portal"
    >
      <Building2 className="h-5 w-5" />
    </Link>
  );
}
