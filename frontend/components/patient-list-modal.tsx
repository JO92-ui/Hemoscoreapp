// FILE: frontend/components/patient-list-modal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Full-screen modal overlay listing all saved patients.
// Features:
//   · Real-time search (name, folio, patient_id)
//   · Open, Duplicate, Delete per patient
//   · "OPEN" badge on the currently active patient
//   · Shows last risk percent and updated_at timestamp
//   · Closes on Escape or backdrop click
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Copy, Search, Trash2, UserCircle2, X } from "lucide-react";
import clsx from "clsx";
import { patientDB } from "@/lib/db";
import type { PatientRecord } from "@/lib/types";

// ── Props ─────────────────────────────────────────────────────────────────────

interface PatientListModalProps {
  currentPatientId: string;
  onOpen:           (record: PatientRecord) => void;
  onClose:          () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function riskColor(category: string): string {
  switch (category) {
    case "low":       return "text-emerald-400";
    case "medium":    return "text-amber-400";
    case "high":      return "text-red-400";
    case "very_high": return "text-rose-400";
    default:          return "text-slate-400";
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PatientListModal({
  currentPatientId,
  onOpen,
  onClose,
}: PatientListModalProps) {
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [query,    setQuery]    = useState("");
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPatients(await patientDB.getAll());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this patient record? This cannot be undone.")) return;
    await patientDB.delete(id);
    setPatients((prev) => prev.filter((p) => p.patient_id !== id));
  }

  async function handleDuplicate(record: PatientRecord, e: React.MouseEvent) {
    e.stopPropagation();
    const copy = await patientDB.duplicate(record);
    setPatients((prev) => [copy, ...prev]);
  }

  // Local search — name, folio, or patient_id (prefix)
  const filtered = query.trim()
    ? patients.filter((p) => {
        const q = query.toLowerCase();
        return (
          p.patient_name?.toLowerCase().includes(q) ||
          p.hospital_id?.toLowerCase().includes(q)  ||
          p.patient_id.startsWith(q)
        );
      })
    : patients;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative mx-4 w-full max-w-lg card rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a3a57] flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">Saved Patients</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {patients.length} record{patients.length !== 1 ? "s" : ""} stored in this browser
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-[#1a3a57] flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, folio, or ID&hellip;"
              className="field-input pl-8 text-xs"
              autoFocus
            />
          </div>
        </div>

        {/* Patient list */}
        <div className="overflow-y-auto flex-1 py-2 px-3 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-500">
              <div className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-[#1a3a57] border-t-blue-500" />
              Loading&hellip;
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <UserCircle2 className="h-10 w-10 text-slate-700 mb-3" />
              <p className="text-sm text-slate-500">
                {query ? "No patients match your search" : "No patients saved yet"}
              </p>
              {!query && (
                <p className="text-xs text-slate-600 mt-1">
                  Data is saved automatically as you enter it
                </p>
              )}
            </div>
          ) : (
            filtered.map((p) => {
              const isCurrent = p.patient_id === currentPatientId;

              // Latest available risk result across all timepoints
              const tpValues  = Object.values(p.timepoint_risks);
              const lastRisk  = tpValues.length > 0
                ? tpValues[tpValues.length - 1]?.risk_result ?? null
                : null;

              // Count how many timepoints have data
              const tpCount = Object.keys(p.timepoint_risks).length;

              return (
                <div
                  key={p.patient_id}
                  onClick={() => onOpen(p)}
                  className={clsx(
                    "group flex items-start gap-3 rounded-xl px-3.5 py-3 cursor-pointer transition-all border",
                    isCurrent
                      ? "border-blue-700/60 bg-blue-950/20"
                      : "border-transparent hover:border-[#1a3a57] hover:bg-[#0f2236]",
                  )}
                >
                  {/* Avatar */}
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#152e47]">
                    <UserCircle2 className="h-5 w-5 text-blue-400/60" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white truncate">
                        {p.patient_name ?? "Unnamed patient"}
                      </span>
                      {isCurrent && (
                        <span className="rounded-full bg-blue-900/50 px-1.5 py-0.5 text-[9px] font-bold text-blue-400 flex-shrink-0 tracking-wider">
                          OPEN
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {p.hospital_id && (
                        <span className="text-[10px] text-slate-500">
                          Folio: {p.hospital_id}
                        </span>
                      )}
                      {tpCount > 0 && (
                        <span className="text-[10px] text-slate-600">
                          {tpCount} timepoint{tpCount !== 1 ? "s" : ""}
                        </span>
                      )}
                      {lastRisk && (
                        <span className={clsx("text-[10px] font-semibold", riskColor(lastRisk.category))}>
                          {lastRisk.risk_percent.toFixed(1)}% risk
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-600">
                      <Clock className="h-2.5 w-2.5 flex-shrink-0" />
                      <span>{formatDate(p.updated_at)}</span>
                    </div>
                  </div>

                  {/* Per-row actions — visible on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={(e) => handleDuplicate(p, e)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-[#152e47] hover:text-slate-200 transition-colors"
                      title="Duplicate patient"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(p.patient_id, e)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-red-950/40 hover:text-red-400 transition-colors"
                      title="Delete patient"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer note */}
        <div className="border-t border-[#1a3a57] px-5 py-2.5 flex-shrink-0">
          <p className="text-[10px] text-slate-600">
            Stored in your browser&apos;s local IndexedDB &mdash; no data leaves your device.
          </p>
        </div>

      </div>
    </div>
  );
}
