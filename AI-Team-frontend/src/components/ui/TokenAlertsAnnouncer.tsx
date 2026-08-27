"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { authenticatedFetch } from "@/lib/authenticatedFetch";
import { AlertTriangle, X } from "lucide-react";

export default function TokenAlertsAnnouncer() {
  const { userId } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;

    const fetchAlerts = async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE;
        const res = await authenticatedFetch(`${base}/users/${userId}/alerts`);
        if (res.ok) {
          const data = await res.json();
          setAlerts(data);
        }
      } catch (e) {
        // ignore silently
      }
    };

    fetchAlerts();
    // Poll every 3 minutes
    const interval = setInterval(fetchAlerts, 1000 * 60 * 3);
    return () => clearInterval(interval);
  }, [userId]);

  const dismissAlert = async (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE;
      await authenticatedFetch(`${base}/users/alerts/${id}/dismiss`, {
        method: "PATCH",
      });
    } catch {}
  };

  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-6 z-[100] flex flex-col gap-3 max-w-sm">
      {alerts.map(a => (
        <div key={a.id} className="relative overflow-hidden rounded-2xl bg-amber-500 text-white shadow-xl animate-in slide-in-from-bottom flex gap-3 p-4">
          <AlertTriangle className="shrink-0" />
          <div className="flex-1 pr-6">
            <h4 className="font-bold text-sm">Quota Alert</h4>
            <p className="text-sm opacity-90 leading-tight mt-1">{a.message}</p>
          </div>
          <button 
            onClick={() => dismissAlert(a.id)}
            className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-black/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
