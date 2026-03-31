// FILE: frontend/components/patient-bar.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Thin context bar rendered directly below the Header.
// Shows the current patient identity (name + folio) with inline editing,
// a discrete autosave status indicator, and action buttons:
//   New · Open patients · Save · Delete current patient.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Download, Edit2, Folder, FolderOpen, Save, Sheet, Trash2, Upload, UserPlus, X } from "lucide-react";
import clsx from "clsx";
import type { SaveStatus } from "@/lib/types";

// ── Props ─────────────────────────────────────────────────────────────────────

interface PatientBarProps {
  patientName:         string | null;
  hospitalId:          string | null;
  saveStatus:          SaveStatus;
  lastSavedAt:         string | null;
  hasSavedRecord:      boolean;
  // Folder status
  patientsFolderName:  string | null;   // display name of the set patients folder
  exportsFolderName:   string | null;   // display name of the set exports folder
  // Actions
  onNew:               () => void;
  onOpenList:          () => void;
  onSave:              () => void;
  onDelete:            () => void;
  onImport:            () => void;
  onExport:            () => void;
  onExportExcel:       () => void;
  onSaveAs:            () => void;
  onSetPatientsFolder: () => void;
  onSetExportsFolder:  () => void;
  onNameChange:        (name:  string | null) => void;
  onFolioChange:       (folio: string | null) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour:   "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PatientBar({
  patientName,
  hospitalId,
  saveStatus,
  lastSavedAt,
  hasSavedRecord,
  patientsFolderName,
  exportsFolderName,
  onNew,
  onOpenList,
  onSave,
  onDelete,
  onImport,
  onExport,
  onExportExcel,
  onSaveAs,
  onSetPatientsFolder,
  onSetExportsFolder,
  onNameChange,
  onFolioChange,
}: PatientBarProps) {
  const [editingName,    setEditingName]    = useState(false);
  const [editingFolio,   setEditingFolio]   = useState(false);
  const [nameInput,      setNameInput]      = useState("");
  const [folioInput,     setFolioInput]     = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const nameRef      = useRef<HTMLInputElement>(null);
  const folioRef     = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const folderMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
      if (folderMenuRef.current && !folderMenuRef.current.contains(e.target as Node)) {
        setShowFolderMenu(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  function startEditName() {
    setNameInput(patientName ?? "");
    setEditingName(true);
    setTimeout(() => nameRef.current?.focus(), 0);
  }

  function commitName() {
    onNameChange(nameInput.trim() || null);
    setEditingName(false);
  }

  function startEditFolio() {
    setFolioInput(hospitalId ?? "");
    setEditingFolio(true);
    setTimeout(() => folioRef.current?.focus(), 0);
  }

  function commitFolio() {
    onFolioChange(folioInput.trim() || null);
    setEditingFolio(false);
  }

  return (
    <div className="border-b border-[#1a3a57] bg-[#0a1929]">
      <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 xl:px-10 py-2 flex items-center gap-3 flex-wrap">

        {/* ── Patient icon ──────────────────────────────────────────────── */}
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#152e47] flex-shrink-0">
          <svg
            className="h-3 w-3 text-blue-400"
            fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}
          >
            <path
              strokeLinecap="round" strokeLinejoin="round"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>

        {/* ── Patient name ──────────────────────────────────────────────── */}
        {editingName ? (
          <div className="flex items-center gap-1">
            <input
              ref={nameRef}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")  commitName();
                if (e.key === "Escape") setEditingName(false);
              }}
              className="w-40 rounded-md border border-[#2d5a8a] bg-[#0b1929] px-2 py-0.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Patient name"
              maxLength={80}
            />
            <button onClick={commitName}             title="Confirm" className="p-0.5 text-emerald-400 hover:text-emerald-300 transition-colors"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => setEditingName(false)} title="Cancel" className="p-0.5 text-slate-500 hover:text-slate-300 transition-colors"><X     className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <button
            onClick={startEditName}
            className="group flex items-center gap-1 text-xs text-slate-300 hover:text-white transition-colors min-w-0"
            title="Click to edit patient name"
          >
            <span className="truncate font-semibold max-w-[140px]">
              {patientName ?? "Unnamed patient"}
            </span>
            <Edit2 className="h-3 w-3 text-slate-600 group-hover:text-slate-400 flex-shrink-0" />
          </button>
        )}

        <span className="text-slate-700 text-xs flex-shrink-0 select-none">&middot;</span>

        {/* ── Folio / hospital ID ───────────────────────────────────────── */}
        {editingFolio ? (
          <div className="flex items-center gap-1">
            <input
              ref={folioRef}
              value={folioInput}
              onChange={(e) => setFolioInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")  commitFolio();
                if (e.key === "Escape") setEditingFolio(false);
              }}
              className="w-32 rounded-md border border-[#2d5a8a] bg-[#0b1929] px-2 py-0.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Folio / hospital ID"
              maxLength={40}
            />
            <button onClick={commitFolio}               title="Confirm" className="p-0.5 text-emerald-400 hover:text-emerald-300 transition-colors"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => setEditingFolio(false)} title="Cancel" className="p-0.5 text-slate-500 hover:text-slate-300 transition-colors"><X     className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <button
            onClick={startEditFolio}
            className="group flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors min-w-0"
            title="Click to edit folio / hospital ID"
          >
            <span className="truncate max-w-[120px]">
              {hospitalId ? `Folio: ${hospitalId}` : "No folio"}
            </span>
            <Edit2 className="h-3 w-3 text-slate-700 group-hover:text-slate-500 flex-shrink-0" />
          </button>
        )}

        {/* ── Save status ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 text-[11px] ml-auto flex-shrink-0">
          {saveStatus === "saving" && (
            <>
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              <span className="text-amber-400/80">Saving&hellip;</span>
            </>
          )}
          {saveStatus === "saved" && lastSavedAt && (
            <>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-slate-500">
                Saved locally &middot; {formatTime(lastSavedAt)}
              </span>
            </>
          )}
          {saveStatus === "idle" && (
            <span className="text-slate-700">Not saved</span>
          )}
        </div>

        {/* ── Action buttons ───────────────────────────────────────────── */}
        <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">

          {/* Delete — only visible when a record exists in DB */}
          {hasSavedRecord && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 text-xs font-medium text-slate-600 hover:border-red-800/60 hover:bg-red-950/20 hover:text-red-400 transition-colors"
              title="Delete current patient"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}

          {/* Thin separator */}
          <span className="hidden sm:block h-4 w-px bg-[#1a3a57] mx-0.5 flex-shrink-0" />

          {/* Import */}
          <button
            onClick={onImport}
            className="flex items-center gap-1.5 rounded-lg border border-[#1a3a57] bg-[#0f2236] px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-[#2d5a8a] hover:text-white transition-colors"
            title="Import patient from .json file"
          >
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Import</span>
          </button>

          {/* Export dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => { setShowExportMenu((v) => !v); setShowFolderMenu(false); }}
              className="flex items-center gap-1 rounded-lg border border-[#1a3a57] bg-[#0f2236] px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-[#2d5a8a] hover:text-white transition-colors"
              title="Export options"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[168px] rounded-lg border border-[#1a3a57] bg-[#0b1929] py-1 shadow-xl">
                <button
                  onClick={() => { onExport(); setShowExportMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-[#152e47] hover:text-white transition-colors"
                >
                  <Download className="h-3.5 w-3.5 text-slate-500" />
                  Export JSON
                </button>
                <button
                  onClick={() => { onExportExcel(); setShowExportMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-[#152e47] hover:text-white transition-colors"
                >
                  <Sheet className="h-3.5 w-3.5 text-slate-500" />
                  Export Excel (CSV)
                </button>
                <div className="my-1 border-t border-[#1a3a57]" />
                <button
                  onClick={() => { onSaveAs(); setShowExportMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-[#152e47] hover:text-white transition-colors"
                >
                  <Save className="h-3.5 w-3.5 text-slate-500" />
                  Save As…
                </button>
              </div>
            )}
          </div>

          {/* Folders dropdown */}
          <div className="relative" ref={folderMenuRef}>
            <button
              onClick={() => { setShowFolderMenu((v) => !v); setShowExportMenu(false); }}
              className="flex items-center gap-1 rounded-lg border border-[#1a3a57] bg-[#0f2236] px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-[#2d5a8a] hover:text-white transition-colors"
              title="Folder settings"
            >
              <Folder className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Folders</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>

            {showFolderMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-lg border border-[#1a3a57] bg-[#0b1929] py-1 shadow-xl">
                {/* Patients folder */}
                <div className="px-3 pt-2 pb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Patients folder</p>
                  {patientsFolderName && (
                    <p className="mt-0.5 truncate text-[11px] text-emerald-500">
                      ✓ {patientsFolderName}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { onSetPatientsFolder(); setShowFolderMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-[#152e47] hover:text-white transition-colors"
                >
                  <FolderOpen className="h-3.5 w-3.5 text-slate-500" />
                  {patientsFolderName ? "Change Patients Folder" : "Set Patients Folder"}
                </button>

                <div className="my-1 border-t border-[#1a3a57]" />

                {/* Exports folder */}
                <div className="px-3 pt-2 pb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Exports folder</p>
                  {exportsFolderName && (
                    <p className="mt-0.5 truncate text-[11px] text-emerald-500">
                      ✓ {exportsFolderName}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { onSetExportsFolder(); setShowFolderMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-[#152e47] hover:text-white transition-colors"
                >
                  <FolderOpen className="h-3.5 w-3.5 text-slate-500" />
                  {exportsFolderName ? "Change Exports Folder" : "Set Exports Folder"}
                </button>
              </div>
            )}
          </div>

          <span className="hidden sm:block h-4 w-px bg-[#1a3a57] mx-0.5 flex-shrink-0" />

          <button
            onClick={onSave}
            className="flex items-center gap-1.5 rounded-lg border border-[#1a3a57] bg-[#0f2236] px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-[#2d5a8a] hover:text-white transition-colors"
            title="Save now"
          >
            <Save className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Save</span>
          </button>

          <button
            onClick={onOpenList}
            className="flex items-center gap-1.5 rounded-lg border border-[#1a3a57] bg-[#0f2236] px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-[#2d5a8a] hover:text-white transition-colors"
            title="Open saved patients"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Patients</span>
          </button>

          <button
            onClick={onNew}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
              "border-blue-800/50 bg-blue-900/20 text-blue-300 hover:bg-blue-900/40 hover:text-white",
            )}
            title="New patient"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New</span>
          </button>
        </div>

      </div>
    </div>
  );
}
