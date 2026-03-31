// FILE: frontend/lib/file-system.ts
// ─────────────────────────────────────────────────────────────────────────────
// File System Access API wrappers for HEMOSCOREAPP.
//
// Provides native OS file-picker dialogs for:
//   · Import (showOpenFilePicker)  — open any .json patient file
//   · Export JSON / Save As       — (showSaveFilePicker) write .json anywhere
//   · Export CSV/Excel            — (showSaveFilePicker) write .csv anywhere
//   · Set default folder          — (showDirectoryPicker) pick folder once;
//                                    handle stored in IndexedDB for silent reuse
//
// Supported browsers: Chrome 86+, Edge 86+
// Fallback for unsupported browsers (Firefox/Safari): <input> / blob download
//
// Never evaluated server-side — only imported by "use client" components.
// ─────────────────────────────────────────────────────────────────────────────

import type { PatientRecord } from "@/lib/types";
import type { SeriesState } from "@/lib/series";

// ── Storage keys (referenced from page.tsx to load handles on mount) ──────────
export const HANDLE_PATIENTS_KEY = "patientsFolder";
export const HANDLE_EXPORTS_KEY  = "exportsFolder";

// ── File System Access API type augmentation ──────────────────────────────────
// TypeScript 5.5's lib.dom.d.ts does not yet include the full File System
// Access API surface (showOpenFilePicker, showSaveFilePicker,
// showDirectoryPicker, Handle.queryPermission / requestPermission).
// We declare only the subset used here.

type FilePickerAccept = Record<string, string[]>;
interface FilePickerAcceptType { description?: string; accept?: FilePickerAccept; }

type FSAWindow = typeof window & {
  showOpenFilePicker(opts?: {
    types?:                   FilePickerAcceptType[];
    multiple?:                boolean;
    excludeAcceptAllOption?:  boolean;
  }): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker(opts?: {
    suggestedName?:           string;
    types?:                   FilePickerAcceptType[];
    excludeAcceptAllOption?:  boolean;
  }): Promise<FileSystemFileHandle>;
  showDirectoryPicker(opts?: {
    mode?:    "read" | "readwrite";
    startIn?: string;
  }): Promise<FileSystemDirectoryHandle>;
};

/** Return window cast to the File System Access API surface. */
const fsaWindow = () => window as FSAWindow;

// ── Feature detection ─────────────────────────────────────────────────────────

export function isFileSystemAccessSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "showOpenFilePicker" in window &&
    "showSaveFilePicker" in window &&
    "showDirectoryPicker" in window
  );
}

// ── Permission helper ─────────────────────────────────────────────────────────

/**
 * Verify (or interactively request) readwrite permission on a stored directory
 * handle.  Chrome/Edge usually preserve the permission across page reloads
 * within the same session; after a full browser restart a one-time prompt may
 * appear.  Returns true if the permission is granted.
 *
 * Note: queryPermission / requestPermission are defined in the W3C File System
 * Access spec but are not yet included in TypeScript's standard lib.dom.d.ts,
 * so we call them via a typed local cast.
 */
export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const opts = { mode: "readwrite" };
  // Typed cast — these methods exist in Chrome/Edge 86+ per the W3C spec.
  type PermissionHandle = {
    queryPermission(d: { mode: string }): Promise<string>;
    requestPermission(d: { mode: string }): Promise<string>;
  };
  const h = handle as FileSystemDirectoryHandle & PermissionHandle;
  if (typeof h.queryPermission === "function") {
    if ((await h.queryPermission(opts)) === "granted") return true;
  }
  if (typeof h.requestPermission === "function") {
    return (await h.requestPermission(opts)) === "granted";
  }
  return true; // permission API unavailable in this browser — assume granted
}

// ── Autosave: write patient → real folder (silently) ─────────────────────────

/**
 * Write / overwrite a PatientRecord as {name}_{id8}.json inside `dir`.
 * The caller must have already checked permission via verifyPermission().
 */
export async function writePatientToDir(
  dir:     FileSystemDirectoryHandle,
  patient: PatientRecord,
): Promise<void> {
  const safeName = (patient.patient_name ?? "patient")
    .replace(/[^a-z0-9_\- ]/gi, "_")
    .trim()
    .slice(0, 40) || "patient";
  const fileName = `${safeName}_${patient.patient_id.slice(0, 8)}.json`;
  const fh       = await dir.getFileHandle(fileName, { create: true });
  const writable = await fh.createWritable();
  await writable.write(JSON.stringify(patient, null, 2));
  await writable.close();
}

// ── Import ────────────────────────────────────────────────────────────────────

/**
 * Open a native OS file picker that accepts .json patient files.
 * Returns the parsed PatientRecord, or null if the user cancels.
 */
export async function importPatientFromFile(): Promise<PatientRecord | null> {
  if (!isFileSystemAccessSupported()) {
    return importPatientFallback();
  }
  try {
    const [fh] = await fsaWindow().showOpenFilePicker({
      types: [{
        description: "HEMOSCOREAPP patient file",
        accept:      { "application/json": [".json"] },
      }],
      multiple: false,
    });
    const file = await fh.getFile();
    const text = await file.text();
    return JSON.parse(text) as PatientRecord;
  } catch (e) {
    if ((e as DOMException).name === "AbortError") return null;
    throw e;
  }
}

/** Fallback: hidden <input type="file"> for Firefox / older Safari. */
function importPatientFallback(): Promise<PatientRecord | null> {
  return new Promise((resolve) => {
    const input    = document.createElement("input");
    input.type     = "file";
    input.accept   = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      try {
        resolve(JSON.parse(await file.text()) as PatientRecord);
      } catch {
        resolve(null);
      }
    };
    // Some browsers fire oncancel, others don't — set a short cleanup timer.
    input.oncancel = () => resolve(null);
    input.click();
  });
}

// ── Export patient as JSON ────────────────────────────────────────────────────

/**
 * Open a native Save-As dialog and write the patient as a .json file.
 * Returns true if successfully saved; false if the user cancelled.
 */
export async function exportPatientToFile(
  patient:        PatientRecord,
  suggestedName?: string,
): Promise<boolean> {
  const base = sanitizeFilename(
    suggestedName ?? buildFileName(patient, "json"),
  );
  if (!isFileSystemAccessSupported()) {
    downloadBlob(JSON.stringify(patient, null, 2), base, "application/json");
    return true;
  }
  try {
    const fh = await fsaWindow().showSaveFilePicker({
      suggestedName: base,
      types: [{
        description: "HEMOSCOREAPP patient file",
        accept:      { "application/json": [".json"] },
      }],
    });
    const writable = await fh.createWritable();
    await writable.write(JSON.stringify(patient, null, 2));
    await writable.close();
    return true;
  } catch (e) {
    if ((e as DOMException).name === "AbortError") return false;
    throw e;
  }
}

// ── Export patient as CSV / Excel ─────────────────────────────────────────────

/**
 * Generate a structured CSV from the patient record and open a Save-As dialog
 * (.csv extension so Excel / Numbers / LibreOffice can open it directly).
 * Returns true if saved; false if cancelled.
 */
export async function exportPatientExcel(patient: PatientRecord): Promise<boolean> {
  const csv  = buildPatientCSV(patient);
  const base = sanitizeFilename(buildFileName(patient, "csv"));
  if (!isFileSystemAccessSupported()) {
    downloadBlob(csv, base, "text/csv");
    return true;
  }
  try {
    const fh = await fsaWindow().showSaveFilePicker({
      suggestedName: base,
      types: [{
        description: "CSV Spreadsheet",
        accept:      { "text/csv": [".csv"] },
      }],
    });
    const writable = await fh.createWritable();
    await writable.write(csv);
    await writable.close();
    return true;
  } catch (e) {
    if ((e as DOMException).name === "AbortError") return false;
    throw e;
  }
}

// ── Directory picker ──────────────────────────────────────────────────────────

/**
 * Open the OS directory picker.
 * Returns the FileSystemDirectoryHandle or null if the user cancels.
 * The handle can be stored in IndexedDB (via handleDB.saveHandle) and reused
 * for silent autosave writes on subsequent page loads.
 */
export async function pickFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) {
    alert("Your browser does not support folder selection. Please use Chrome or Edge.");
    return null;
  }
  try {
    return await fsaWindow().showDirectoryPicker({ mode: "readwrite" });
  } catch (e) {
    if ((e as DOMException).name === "AbortError") return null;
    throw e;
  }
}

// ── Fallback blob download ────────────────────────────────────────────────────

export function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Private helpers ───────────────────────────────────────────────────────────

function buildFileName(patient: PatientRecord, ext: string): string {
  const name = (patient.patient_name ?? "patient")
    .replace(/\s+/g, "_")
    .slice(0, 30);
  return `${name}_${patient.patient_id.slice(0, 8)}.${ext}`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9._\- ]/gi, "_");
}

function csvCell(v: string | number | null | undefined): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}

function buildPatientCSV(patient: PatientRecord): string {
  const rows: string[] = [];
  const tps = ["baseline", "6h", "12h", "24h", "48h"] as const;

  // ── Header ────────────────────────────────────────────────────────────────
  rows.push(csvRow(["HEMOSCOREAPP Patient Export"]));
  rows.push(csvRow(["Patient name", patient.patient_name ?? ""]));
  rows.push(csvRow(["Hospital ID",  patient.hospital_id ?? ""]));
  rows.push(csvRow(["Patient ID",   patient.patient_id]));
  rows.push(csvRow(["Created",      patient.created_at]));
  rows.push(csvRow(["Updated",      patient.updated_at]));
  rows.push("");

  // ── Clinical inputs ───────────────────────────────────────────────────────
  rows.push(csvRow(["CLINICAL INPUTS"]));
  rows.push(csvRow(["Variable", "Value"]));
  for (const [k, v] of Object.entries(patient.clinical_inputs)) {
    rows.push(csvRow([k, v]));
  }
  rows.push("");

  // ── Hemodynamic series ────────────────────────────────────────────────────
  rows.push(csvRow(["HEMODYNAMIC SERIES"]));
  rows.push(csvRow(["Variable", ...tps]));
  for (const [varName, tpMap] of Object.entries(patient.series as SeriesState)) {
    rows.push(csvRow([
      varName,
      ...tps.map((tp) => (tpMap as Record<string, number | null>)[tp] ?? ""),
    ]));
  }
  rows.push("");

  // ── SCAI classification ───────────────────────────────────────────────────
  rows.push(csvRow(["SCAI CLASSIFICATION"]));
  rows.push(csvRow(["Timepoint", "Value"]));
  for (const tp of tps) {
    rows.push(csvRow([tp, (patient.scai as Record<string, number | null>)[tp] ?? ""]));
  }
  rows.push("");

  // ── Risk timeline ─────────────────────────────────────────────────────────
  rows.push(csvRow(["RISK TIMELINE"]));
  rows.push(csvRow(["Timepoint", "Risk %", "Category", "Label"]));
  for (const tp of tps) {
    const r = patient.timepoint_risks[tp];
    if (r) {
      rows.push(csvRow([tp, r.risk_percent, r.risk_result.category, r.risk_result.label]));
    }
  }

  return rows.join("\r\n");
}
