// FILE: frontend/app/settings/page.tsx
"use client";
// ─────────────────────────────────────────────────────────────────────────────
// Settings page.  Three sections:
//   1. Doctor Profile  — name, specialty, hospital
//   2. Security        — change username, change password
//   3. Storage Folders — patients folder, exports folder
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Folder,
  FolderOpen,
  HardDrive,
  LogOut,
  Save,
  Settings,
  User,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";
import { saveProfile, getProfile } from "@/lib/profile";

import { handleDB } from "@/lib/db";
import { pickFolder, HANDLE_PATIENTS_KEY, HANDLE_EXPORTS_KEY } from "@/lib/file-system";

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionCard({
  title, icon, children, defaultOpen = true,
}: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-[#1a3a57] bg-[#0a1929] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-6 py-4 hover:bg-[#0f2236] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-slate-500">{icon}</span>
          <span className="text-sm font-semibold text-white">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
      </button>
      {open && (
        <div className="border-t border-[#1a3a57] px-6 pb-6 pt-5">
          {children}
        </div>
      )}
    </div>
  );
}

function StatusMessage({ type, msg }: { type: "success" | "error"; msg: string }) {
  return (
    <div className={clsx(
      "mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
      type === "success"
        ? "border-emerald-800/50 bg-emerald-950/30 text-emerald-300"
        : "border-red-800/60   bg-red-950/30    text-red-300",
    )}>
      <span className="mt-0.5">{type === "success" ? "✓" : "!"}</span>
      <span>{msg}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router  = useRouter();
  const { isLoading, isAuthenticated, logout, refreshProfile } = useAuth();

  // ── Doctor profile state ──────────────────────────────────────────────────
  const [docName,    setDocName]    = useState("");
  const [specialty,  setSpecialty]  = useState("");
  const [hospital,   setHospital]   = useState("");
  const [profSaving, setProfSaving] = useState(false);
  const [profMsg,    setProfMsg]    = useState<{ type: "success"|"error"; msg: string } | null>(null);



  // ── Folder state ──────────────────────────────────────────────────────────
  const [patientsFolder, setPatientsFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [exportsFolder,  setExportsFolder]  = useState<FileSystemDirectoryHandle | null>(null);
  const [folderMsg,      setFolderMsg]      = useState<{ type: "success"|"error"; msg: string } | null>(null);

  const mounted = useRef(false);

  // ── Load existing data ────────────────────────────────────────────────────
  useEffect(() => {
    mounted.current = true;
    Promise.all([
      getProfile(),
      handleDB.getHandle(HANDLE_PATIENTS_KEY),
      handleDB.getHandle(HANDLE_EXPORTS_KEY),
    ]).then(([prof, ph, eh]) => {
      if (!mounted.current) return;
      if (prof) {
        setDocName(prof.doctorName  ?? "");
        setSpecialty(prof.specialty ?? "");
        setHospital(prof.hospital   ?? "");
      }
      if (ph) setPatientsFolder(ph);
      if (eh) setExportsFolder(eh);
    }).catch(() => {});
    return () => { mounted.current = false; };
  }, []);

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSaveProfile = useCallback(async () => {
    setProfSaving(true);
    setProfMsg(null);
    try {
      await saveProfile({
        doctorName: docName.trim()   || null,
        specialty:  specialty.trim() || null,
        hospital:   hospital.trim()  || null,
      });
      await refreshProfile();
      setProfMsg({ type: "success", msg: "Profile saved." });
    } catch {
      setProfMsg({ type: "error", msg: "Failed to save profile." });
    } finally {
      setProfSaving(false);
    }
  }, [docName, specialty, hospital, refreshProfile]);



  // ── Set patients folder ───────────────────────────────────────────────────
  const handleSetPatientsFolder = useCallback(async () => {
    const dir = await pickFolder().catch(() => null);
    if (!dir) return;
    try {
      await handleDB.saveHandle(HANDLE_PATIENTS_KEY, dir);
      setPatientsFolder(dir);
      setFolderMsg({ type: "success", msg: `Patients folder set: ${dir.name}` });
    } catch {
      setFolderMsg({ type: "error", msg: "Failed to save folder." });
    }
  }, []);

  // ── Set exports folder ────────────────────────────────────────────────────
  const handleSetExportsFolder = useCallback(async () => {
    const dir = await pickFolder().catch(() => null);
    if (!dir) return;
    try {
      await handleDB.saveHandle(HANDLE_EXPORTS_KEY, dir);
      setExportsFolder(dir);
      setFolderMsg({ type: "success", msg: `Exports folder set: ${dir.name}` });
    } catch {
      setFolderMsg({ type: "error", msg: "Failed to save folder." });
    }
  }, []);

  function handleLogout() {
    logout();
    router.replace("/home");
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#061018]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1a3a57] border-t-blue-500" />
      </div>
    );
  }
  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen flex-col bg-[#061018]">

      {/* ── Top nav ──────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-[#1a3a57] bg-[#061018]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700">
              <Activity className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-bold tracking-tight text-white">HEMOSCOREAPP</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => router.push("/home")}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-[#0f2236] hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Home
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-red-950/30 hover:text-red-400 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* ── Page content ─────────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">

        {/* Page title */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#152e47]">
            <Settings className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Settings</h1>
            <p className="text-xs text-slate-500">Profile · Storage</p>
          </div>
        </div>

        <div className="space-y-4">

          {/* ── 1. Doctor Profile ─────────────────────────────────────────── */}
          <SectionCard title="Doctor Profile" icon={<User className="h-4 w-4" />}>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Doctor name
                </label>
                <input
                  type="text"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="Dr. Full Name"
                  className="w-full rounded-xl border border-[#1a3a57] bg-[#081524] px-4 py-2.5
                             text-sm text-slate-100 placeholder-slate-600
                             focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Specialty
                </label>
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="e.g. Interventional Cardiology"
                  className="w-full rounded-xl border border-[#1a3a57] bg-[#081524] px-4 py-2.5
                             text-sm text-slate-100 placeholder-slate-600
                             focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Hospital / Center
                </label>
                <input
                  type="text"
                  value={hospital}
                  onChange={(e) => setHospital(e.target.value)}
                  placeholder="Hospital or medical center name"
                  className="w-full rounded-xl border border-[#1a3a57] bg-[#081524] px-4 py-2.5
                             text-sm text-slate-100 placeholder-slate-600
                             focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={profSaving}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
              >
                {profSaving
                  ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  : <Save className="h-4 w-4" />}
                {profSaving ? "Saving…" : "Save profile"}
              </button>
              {profMsg && <StatusMessage type={profMsg.type} msg={profMsg.msg} />}
            </div>
          </SectionCard>



          {/* ── 3. Storage Folders ────────────────────────────────────────── */}
          <SectionCard title="Storage Folders" icon={<Folder className="h-4 w-4" />} defaultOpen={false}>
            <div className="space-y-5">

              <div className="rounded-lg border border-[#1a3a57] bg-[#081524]/60 px-4 py-3 text-xs text-slate-500">
                <p className="flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5 flex-shrink-0 text-slate-600" />
                  Set optional real folders on your disk for autosave and exports.
                  Files are written automatically — no dialog after initial setup.
                </p>
                <p className="mt-1.5 text-[10px] text-slate-700">
                  Suggested path: Documents/HemoscoreApp/Patients — Documents/HemoscoreApp/Exports
                </p>
              </div>

              {/* Patients folder */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Patients folder
                </p>
                {patientsFolder ? (
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-3 py-2 text-xs">
                    <Check className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
                    <span className="truncate font-medium text-emerald-300">{patientsFolder.name}</span>
                  </div>
                ) : (
                  <p className="mb-2 text-xs text-slate-600">Not configured — patients saved in browser storage only.</p>
                )}
                <button
                  onClick={handleSetPatientsFolder}
                  className="flex items-center gap-2 rounded-xl border border-[#2d5a8a] bg-[#0f2236] px-4 py-2.5 text-xs font-medium text-slate-300 hover:text-white transition-colors"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  {patientsFolder ? "Change patients folder" : "Set patients folder"}
                </button>
              </div>

              {/* Exports folder */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Exports folder
                </p>
                {exportsFolder ? (
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-3 py-2 text-xs">
                    <Check className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
                    <span className="truncate font-medium text-emerald-300">{exportsFolder.name}</span>
                  </div>
                ) : (
                  <p className="mb-2 text-xs text-slate-600">Not configured — use Export buttons in the calculator.</p>
                )}
                <button
                  onClick={handleSetExportsFolder}
                  className="flex items-center gap-2 rounded-xl border border-[#2d5a8a] bg-[#0f2236] px-4 py-2.5 text-xs font-medium text-slate-300 hover:text-white transition-colors"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  {exportsFolder ? "Change exports folder" : "Set exports folder"}
                </button>
              </div>

              {folderMsg && <StatusMessage type={folderMsg.type} msg={folderMsg.msg} />}
            </div>
          </SectionCard>
        </div>
      </main>

      <footer className="border-t border-[#1a3a57] py-4">
        <p className="text-center text-[10px] text-slate-700">
          HEMOSCOREAPP · Local/Offline · {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
