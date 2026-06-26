"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminRoot() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/admin/agents");
  }, [router]);

  // The parent layout owns the loading state while it checks the admin gate.
  // Keeping this route renderable avoids throwing a server redirect through that
  // client boundary, which caused the uncaught client-side exception.
  return null;
}
