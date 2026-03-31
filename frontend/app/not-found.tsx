// FILE: frontend/app/not-found.tsx
"use client";

import Link from "next/link";
import { Activity } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#061018] px-4 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-900/50">
        <Activity className="h-8 w-8 text-white" strokeWidth={2.5} />
      </div>

      <h1 className="text-6xl font-bold text-white">404</h1>
      <p className="mt-2 text-lg font-semibold text-slate-300">Page not found</p>
      <p className="mt-1 text-sm text-slate-500">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      <Link
        href="/home"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5
                   text-sm font-semibold text-white shadow-lg shadow-blue-900/40
                   hover:bg-blue-500 transition-colors"
      >
        Back to App
      </Link>

      <p className="mt-8 text-[10px] text-slate-700">
        HEMOSCOREAPP · PULSAR XGBoost · v1.0
      </p>
    </div>
  );
}
