// FILE: frontend/app/home/page.tsx
"use client";
// ─────────────────────────────────────────────────────────────────────────────
// Welcome / Home screen — professional clinical landing page after login.
//
// Layout:
//   A. Header nav (logo + subtitle + Settings + Sign out)
//   B. Hero       (doctor info left / offline + model info right)
//   C. Resume last patient card (large, priority CTA)
//   D. Quick actions (New / Open / Saved Patients)
//   E. Recent patients list (initials only in UI)
//   F. Storage block (folder paths + open buttons)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart2,
  ChevronRight,
  Clock,
  FolderOpen,
  HardDrive,
  LogOut,
  Plus,
  Settings,
  Shield,
  User,
  Users,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";
import { patientDB, handleDB } from "@/lib/db";
import { HANDLE_PATIENTS_KEY, HANDLE_EXPORTS_KEY, pickFolder, verifyPermission } from "@/lib/file-system";
import type { PatientRecord } from "@/lib/types";
import {
  getInitials,
  formatRiskCategory,
  riskCategoryColor,
  riskCategoryBadge,
  avatarBgColor,
  relativeDate,
} from "@/lib/patient-utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch { return "—"; }
}

function timepointLabel(tp: string | null): string {
  if (!tp) return "—";
  const map: Record<string, string> = {
    baseline: "Baseline",
    "6h":     "6 h",
    "12h":    "12 h",
    "24h":    "24 h",
    "48h":    "48 h",
  };
  return map[tp] ?? tp;
}

// ── Initials Avatar ───────────────────────────────────────────────────────────

function InitialsAvatar({
  name,
  patientId,
  size = "md",
}: {
  name: string | null;
  patientId: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = getInitials(name);
  const bg       = avatarBgColor(patientId);
  const sizeClass = {
    sm:  "h-8  w-8  text-xs",
    md:  "h-10 w-10 text-sm",
    lg:  "h-14 w-14 text-base",
  }[size];
  return (
    <div
      className={clsx(
        "flex flex-shrink-0 items-center justify-center rounded-xl font-bold text-white select-none",
        bg,
        sizeClass,
      )}
      title="Patient initials — full name hidden for privacy"
    >
      {initials}
    </div>
  );
}

// ── Risk badge ────────────────────────────────────────────────────────────────

function RiskBadge({ percent, category }: { percent: number; category: string }) {
  return (
    <span className={clsx(
      "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-semibold tabular-nums",
      riskCategoryBadge(category),
    )}>
      {percent.toFixed(1)}% · {formatRiskCategory(category)}
    </span>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-600">
      {label}
    </h2>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const { isLoading, isAuthenticated, doctor, logout } = useAuth();

  // ── Data state ────────────────────────────────────────────────────────────
  const [patients,     setPatients]    = useState<PatientRecord[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [patientsDir,  setPatientsDir] = useState<FileSystemDirectoryHandle | null>(null);
  const [exportsDir,   setExportsDir]  = useState<FileSystemDirectoryHandle | null>(null);
  const mounted = useRef(false);

  // ── Load patient data + folder handles ───────────────────────────────────
  useEffect(() => {
    mounted.current = true;
    Promise.all([
      patientDB.getAll(),
      handleDB.getHandle(HANDLE_PATIENTS_KEY),
      handleDB.getHandle(HANDLE_EXPORTS_KEY),
    ]).then(([pats, ph, eh]) => {
      if (!mounted.current) return;
      setPatients(pats);
      if (ph) setPatientsDir(ph);
      if (eh) setExportsDir(eh);
    }).catch(() => {}).finally(() => {
      if (mounted.current) setStatsLoading(false);
    });
    return () => { mounted.current = false; };
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  function handleLogout() {
    logout();
    router.replace("/home");
  }

  async function handleSetPatientsFolder() {
    const dir = await pickFolder().catch(() => null);
    if (!dir) return;
    await handleDB.saveHandle(HANDLE_PATIENTS_KEY, dir).catch(() => {});
    setPatientsDir(dir);
  }

  async function handleSetExportsFolder() {
    const dir = await pickFolder().catch(() => null);
    if (!dir) return;
    await handleDB.saveHandle(HANDLE_EXPORTS_KEY, dir).catch(() => {});
    setExportsDir(dir);
  }

  async function handleOpenPatientsFolder() {
    if (!patientsDir) { handleSetPatientsFolder(); return; }
    await verifyPermission(patientsDir).catch(() => {});
  }

  async function handleOpenExportsFolder() {
    if (!exportsDir) { handleSetExportsFolder(); return; }
    await verifyPermission(exportsDir).catch(() => {});
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const lastPatient    = patients[0] ?? null;
  const recentPatients = patients.slice(0, 5);
  const patientCount   = patients.length;

  const lastRisk = lastPatient?.current_result?.risk_result
    ?? (lastPatient?.selected_tp
      ? lastPatient.timepoint_risks[lastPatient.selected_tp]?.risk_result
      : undefined)
    ?? null;
  const lastTimepointCount = Object.keys(lastPatient?.timepoint_risks ?? {}).length;

  // ── Loading spinner ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#061018]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1a3a57] border-t-blue-500" />
      </div>
    );
  }
  if (!isAuthenticated) return null;

  const displayName = doctor?.doctorName ? `Dr. ${doctor.doctorName}` : "Doctor";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-[#061018]">

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* A. Header nav                                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 border-b border-[#1a3a57] bg-[#061018]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">

          {/* Logo + subtitle */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg">
              <Activity className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-white leading-none">HEMOSCOREAPP</p>
              <p className="mt-0.5 text-[10px] text-slate-500 leading-none">
                Dynamic Cardiogenic Shock Risk Calculator
              </p>
            </div>
          </div>

          {/* Right nav actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => router.push("/settings")}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-[#0f2236] hover:text-white transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-red-950/30 hover:text-red-400 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Main content                                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 space-y-8">

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* B. Hero                                                          */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* Left — doctor greeting */}
          <div className="rounded-2xl border border-[#1a3a57] bg-gradient-to-br from-[#0a1929] to-[#081524] p-6">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Welcome back</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white lg:text-3xl">
              {displayName}
            </h1>
            {(doctor?.specialty || doctor?.hospital) && (
              <p className="mt-1 text-sm text-slate-400">
                {[doctor.specialty, doctor.hospital].filter(Boolean).join(" · ")}
              </p>
            )}

            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                Last session: {formatDateTime(doctor?.lastLoginAt ?? null)}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Users className="h-3.5 w-3.5 flex-shrink-0" />
                {statsLoading ? (
                  <span className="inline-block h-3.5 w-20 animate-pulse rounded bg-[#152e47]" />
                ) : (
                  <span>
                    <span className="font-semibold text-slate-300">{patientCount}</span>
                    {" "}saved patient{patientCount !== 1 ? "s" : ""} on this device
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right — offline + model info */}
          <div className="rounded-2xl border border-[#1a3a57] bg-[#0a1929] p-6 flex flex-col justify-between">

            <div className="flex flex-wrap gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-800/50 bg-emerald-950/30 px-3 py-1 text-[10px] font-semibold text-emerald-400">
                <HardDrive className="h-2.5 w-2.5" /> Local · Offline mode
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-[#1a3a57] bg-[#0f2236] px-3 py-1 text-[10px] font-semibold text-slate-400">
                <Shield className="h-2.5 w-2.5" /> Data stays on this device
              </span>
            </div>

            <div className="mt-5 flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-900/30">
                <BarChart2 className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">PULSAR XGBoost</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Dynamic risk model · 32 clinical features · 5 timepoints
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  In-hospital mortality · Cardiogenic shock
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2">
              <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-500/80" />
              <p className="text-[10px] font-medium text-amber-500/80">
                Research use only — not a substitute for clinical judgement.
              </p>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* C. Resume last patient — large CTA card                          */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {!statsLoading && (
          lastPatient ? (
            <div>
              <SectionHeader label="Resume last session" />
              <div className="rounded-2xl border border-blue-700/30 bg-gradient-to-r from-[#0a1929] via-[#0c1e33] to-[#0a1929] p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                  {/* Patient identity */}
                  <div className="flex items-center gap-4">
                    <InitialsAvatar
                      name={lastPatient.patient_name}
                      patientId={lastPatient.patient_id}
                      size="lg"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-bold text-white tracking-wide">
                          {getInitials(lastPatient.patient_name)}
                        </p>
                        {lastPatient.hospital_id && (
                          <span className="rounded border border-[#1a3a57] bg-[#0f2236] px-2 py-0.5 text-[10px] font-mono text-slate-400">
                            {lastPatient.hospital_id}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        <span className="text-slate-400 font-medium">Updated</span>{" "}
                        {relativeDate(lastPatient.updated_at)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {lastTimepointCount > 0
                          ? `${lastTimepointCount} timepoint${lastTimepointCount !== 1 ? "s" : ""} computed`
                          : "No predictions computed yet"}
                        {lastPatient.selected_tp && (
                          <span className="ml-2 text-blue-500">
                            · {timepointLabel(lastPatient.selected_tp)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Risk + CTA */}
                  <div className="flex flex-col items-start gap-3 sm:items-end">
                    {lastRisk ? (
                      <div className="sm:text-right">
                        <p className="text-[10px] uppercase tracking-wider text-slate-600">Last risk</p>
                        <p className={clsx(
                          "mt-0.5 text-2xl font-bold tabular-nums",
                          riskCategoryColor(lastRisk.category),
                        )}>
                          {lastRisk.risk_percent.toFixed(1)}%
                        </p>
                        <p className="text-xs font-semibold text-slate-500">
                          {formatRiskCategory(lastRisk.category)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600">No risk computed yet</p>
                    )}
                    <button
                      onClick={() => router.push(`/?patient=${lastPatient.patient_id}`)}
                      className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-500 active:scale-95 transition-all"
                    >
                      Resume clinical session
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* No patients yet — welcoming empty state */
            <div className="rounded-2xl border border-dashed border-[#1a3a57] p-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0f2236]">
                <User className="h-6 w-6 text-slate-600" />
              </div>
              <p className="text-sm font-semibold text-slate-400">No patients saved yet</p>
              <p className="mt-1 text-xs text-slate-600">
                Create your first clinical session to start computing risk.
              </p>
              <button
                onClick={() => router.push("/")}
                className="mx-auto mt-4 flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-500 transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Patient
              </button>
            </div>
          )
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* D. Quick actions                                                  */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div>
          <SectionHeader label="Quick access" />
          <div className="grid grid-cols-3 gap-3">

            <button
              onClick={() => router.push("/")}
              className="group flex flex-col items-start gap-3 rounded-2xl border border-blue-700/30 bg-blue-900/15 p-5 text-left hover:border-blue-600/50 hover:bg-blue-900/25 transition-all"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700/30 text-blue-400 group-hover:bg-blue-700/50">
                <Plus className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">New Patient</p>
                <p className="mt-0.5 text-xs text-slate-500">Start a new clinical session</p>
              </div>
            </button>

            <button
              onClick={() => router.push("/?open=1")}
              className="group flex flex-col items-start gap-3 rounded-2xl border border-teal-700/30 bg-teal-900/15 p-5 text-left hover:border-teal-600/50 hover:bg-teal-900/25 transition-all"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700/30 text-teal-400 group-hover:bg-teal-700/50">
                <FolderOpen className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Open Patient</p>
                <p className="mt-0.5 text-xs text-slate-500">Resume a saved session</p>
              </div>
            </button>

            <button
              onClick={() => router.push("/?open=1")}
              className="group flex flex-col items-start gap-3 rounded-2xl border border-violet-700/30 bg-violet-900/15 p-5 text-left hover:border-violet-600/50 hover:bg-violet-900/25 transition-all"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-700/30 text-violet-400 group-hover:bg-violet-700/50">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Saved Patients</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {statsLoading ? "Loading…" : `${patientCount} record${patientCount !== 1 ? "s" : ""}`}
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* E. Recent patients                                                */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {recentPatients.length > 0 && (
          <div>
            <SectionHeader label="Recent patients" />
            <div className="overflow-hidden rounded-2xl border border-[#1a3a57]">
              {recentPatients.map((p, i) => {
                const risk = p.current_result?.risk_result
                  ?? (p.selected_tp ? p.timepoint_risks[p.selected_tp]?.risk_result : undefined);
                const tpCount = Object.keys(p.timepoint_risks).length;
                return (
                  <div
                    key={p.patient_id}
                    className={clsx(
                      "flex items-center gap-4 px-5 py-4 hover:bg-[#0f2236] transition-colors",
                      i !== recentPatients.length - 1 && "border-b border-[#1a3a57]",
                    )}
                  >
                    <InitialsAvatar name={p.patient_name} patientId={p.patient_id} size="sm" />

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          {getInitials(p.patient_name)}
                        </span>
                        {p.hospital_id && (
                          <span className="rounded border border-[#1a3a57] bg-[#081524] px-2 py-px text-[10px] font-mono text-slate-500">
                            {p.hospital_id}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-600">
                        <span>{relativeDate(p.updated_at)}</span>
                        {tpCount > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-teal-600">{tpCount} tp</span>
                          </>
                        )}
                      </div>
                    </div>

                    {risk && (
                      <div className="hidden sm:block">
                        <RiskBadge percent={risk.risk_percent} category={risk.category} />
                      </div>
                    )}

                    <button
                      onClick={() => router.push(`/?patient=${p.patient_id}`)}
                      className="flex items-center gap-1 rounded-lg border border-[#1a3a57] bg-[#0f2236] px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-[#2d5a8a] hover:text-white transition-colors"
                    >
                      Open
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            {patientCount > 5 && (
              <button
                onClick={() => router.push("/?open=1")}
                className="mt-2 w-full rounded-xl border border-[#1a3a57] py-2.5 text-xs font-medium text-slate-500 hover:bg-[#0f2236] hover:text-white transition-colors"
              >
                View all {patientCount} patients
              </button>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* F. Storage                                                        */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div>
          <SectionHeader label="Storage" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

            {/* Patients folder */}
            <div className="rounded-2xl border border-[#1a3a57] bg-[#0a1929] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                    Patients folder
                  </p>
                  {patientsDir ? (
                    <p className="mt-1.5 truncate text-xs font-medium text-slate-300">
                      {patientsDir.name}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-slate-600">Not configured</p>
                  )}
                </div>
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#0f2236]">
                  <HardDrive className="h-3.5 w-3.5 text-slate-500" />
                </div>
              </div>
              <button
                onClick={handleOpenPatientsFolder}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#1a3a57] py-2 text-xs font-medium text-slate-400 hover:bg-[#0f2236] hover:text-white transition-colors"
              >
                <FolderOpen className="h-3 w-3" />
                {patientsDir ? "Verify access" : "Set folder"}
              </button>
            </div>

            {/* Exports folder */}
            <div className="rounded-2xl border border-[#1a3a57] bg-[#0a1929] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                    Exports folder
                  </p>
                  {exportsDir ? (
                    <p className="mt-1.5 truncate text-xs font-medium text-slate-300">
                      {exportsDir.name}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-slate-600">Not configured</p>
                  )}
                </div>
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#0f2236]">
                  <FolderOpen className="h-3.5 w-3.5 text-slate-500" />
                </div>
              </div>
              <button
                onClick={handleOpenExportsFolder}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#1a3a57] py-2 text-xs font-medium text-slate-400 hover:bg-[#0f2236] hover:text-white transition-colors"
              >
                <FolderOpen className="h-3 w-3" />
                {exportsDir ? "Verify access" : "Set folder"}
              </button>
            </div>
          </div>
          <p className="mt-2 px-1 text-[10px] text-slate-700">
            Folders are optional. Patient data is always saved to browser storage — disk folders enable silent autosave.
          </p>
        </div>

      </main>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Footer                                                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-[#1a3a57] py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <p className="text-[10px] text-slate-700">
            HEMOSCOREAPP · PULSAR XGBoost · Local / Offline
          </p>
          <p className="text-[10px] text-slate-700">
            {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
