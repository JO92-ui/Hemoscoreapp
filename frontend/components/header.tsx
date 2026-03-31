// FILE: frontend/components/header.tsx
"use client";

import { Activity, AlertTriangle, HardDrive, LogOut, Server, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchHealth } from "@/lib/api";
import type { HealthResponse } from "@/lib/types";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";

export default function Header() {
  const router  = useRouter();
  const { isAuthenticated, doctor, logout } = useAuth();
  const [health, setHealth]   = useState<HealthResponse | null>(null);
  const [error, setError]     = useState(false);
  const [checking, setChecking] = useState(true);

  function handleLogout() {
    logout();
    router.replace("/home");
  }

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      setChecking(true);
      try {
        const h = await fetchHealth();
        if (!cancelled) { setHealth(h); setError(false); }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    check();
    const interval = setInterval(check, 30_000); // re-check every 30 s
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const online = !error && health?.model_loaded;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#1a3a57] bg-[#0b1929]/90 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-glow">
              <Activity className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white leading-none">
                HEMOSCOREAPP
              </h1>
              <p className="text-[10px] font-medium text-slate-500 leading-none mt-0.5 uppercase tracking-wide">
                Cardiogenic Shock Risk · PULSAR Model
              </p>
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-4">

            {/* Backend status indicator */}
            <div className="flex items-center gap-2">
              {checking ? (
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-slate-600 animate-pulse-slow" />
                  Connecting…
                </span>
              ) : online ? (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Model online
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Backend offline
                </span>
              )}
            </div>

            {/* Model badge */}
            {health && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[#1a3a57] bg-[#0f2236] px-2.5 py-1 text-xs text-slate-400">
                <Server className="h-3 w-3" />
                {health.status === "ok" ? "XGBoost · PULSAR" : health.status}
              </span>
            )}

            {/* Research disclaimer badge */}
            <span
              className={clsx(
                "hidden lg:inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-medium",
                "border border-amber-900/50 bg-amber-950/30 text-amber-400"
              )}
            >
              Research use only
            </span>

            {/* Local / Offline badge */}
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
              <HardDrive className="h-3 w-3" />
              Local · Offline
            </span>

            {/* Doctor nav (only when authenticated) */}
            {isAuthenticated && (
              <div className="flex items-center gap-1 border-l border-[#1a3a57] pl-3">
                {doctor?.doctorName && (
                  <span className="hidden md:block max-w-[120px] truncate text-xs text-slate-400">
                    {doctor.doctorName}
                  </span>
                )}
                <button
                  onClick={() => router.push("/settings")}
                  title="Settings"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-[#0f2236] hover:text-white transition-colors"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-red-950/30 hover:text-red-400 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
