// FILE: frontend/lib/db.ts
// ─────────────────────────────────────────────────────────────────────────────
// IndexedDB persistence layer for HEMOSCOREAPP.
// Stores:
//   patients  — PatientRecord, indexed by name / hospital_id / updated_at
//   handles   — FileSystemDirectoryHandle for autosave + exports folders
//   auth      — PBKDF2 credentials (single record, key "default")
//   profile   — Doctor profile     (single record, key "default")
// ─────────────────────────────────────────────────────────────────────────────

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { PatientRecord } from "@/lib/types";

// ── Schema ────────────────────────────────────────────────────────────────────

// ── Internal record shapes (not for public use — only via authDB/profileDB) ────

interface AuthRecord {
  key:        string; // always "default"
  username:   string;
  hashB64:    string; // base64 PBKDF2 output
  saltB64:    string; // base64 random salt
  iterations: number;
  createdAt:  string; // ISO
}

interface ProfileRecord {
  key:         string; // always "default"
  doctorName:  string | null;
  specialty:   string | null;
  hospital:    string | null;
  lastLoginAt: string | null;
  updatedAt:   string; // ISO
}

interface HemoDBSchema extends DBSchema {
  patients: {
    key:     string;
    value:   PatientRecord;
    indexes: {
      by_name:        string;
      by_hospital_id: string;
      by_updated_at:  string;
    };
  };
  handles: {
    key:   string;
    value: { key: string; handle: FileSystemDirectoryHandle };
  };
  /** Local PBKDF2 credentials (single record, key "default"). */
  auth: {
    key:   string;
    value: AuthRecord;
  };
  /** Doctor profile (single record, key "default"). */
  profile: {
    key:   string;
    value: ProfileRecord;
  };
}

const DB_NAME    = "hemoscoreapp";
const DB_VERSION = 3;

// Singleton promise — initialised once per browser session.
let _db: Promise<IDBPDatabase<HemoDBSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<HemoDBSchema>> {
  if (_db) return _db;
  _db = openDB<HemoDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion) {
      // v1 schema: patients store
      if (oldVersion < 1) {
        const store = database.createObjectStore("patients", { keyPath: "patient_id" });
        store.createIndex("by_name",        "patient_name", { unique: false });
        store.createIndex("by_hospital_id", "hospital_id",  { unique: false });
        store.createIndex("by_updated_at",  "updated_at",   { unique: false });
      }
      // v2 schema: handles store for FileSystemDirectoryHandle persistence
      if (oldVersion < 2) {
        database.createObjectStore("handles", { keyPath: "key" });
      }
      // v3 schema: auth + profile stores for local login and doctor profile
      if (oldVersion < 3) {
        database.createObjectStore("auth",    { keyPath: "key" });
        database.createObjectStore("profile", { keyPath: "key" });
      }
    },
  });
  return _db;
}

// ── Tiny ID generator — no external dependency beyond SubtleCrypto ────────────

export function generateId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Public API ────────────────────────────────────────────────────────────────

export const patientDB = {
  /** Upsert: inserts or overwrites the record with the same patient_id. */
  async save(patient: PatientRecord): Promise<void> {
    const db = await getDB();
    await db.put("patients", patient);
  },

  async getById(id: string): Promise<PatientRecord | undefined> {
    const db = await getDB();
    return db.get("patients", id);
  },

  /** Returns all patients sorted by updated_at descending (most recent first). */
  async getAll(): Promise<PatientRecord[]> {
    const db  = await getDB();
    const all = await db.getAll("patients");
    return all.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  },

  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete("patients", id);
  },

  /** Creates a copy of the record with a new ID.  Saves and returns the copy. */
  async duplicate(original: PatientRecord): Promise<PatientRecord> {
    const now  = new Date().toISOString();
    const copy: PatientRecord = {
      ...original,
      patient_id:   generateId(),
      patient_name: original.patient_name ? `${original.patient_name} (copy)` : null,
      hospital_id:  null,
      created_at:   now,
      updated_at:   now,
    };
    const db = await getDB();
    await db.put("patients", copy);
    return copy;
  },
};

// ── Directory-handle persistence ──────────────────────────────────────────────

/**
 * Stores and retrieves FileSystemDirectoryHandle objects in IndexedDB.
 * Handles are structured-cloneable and survive page reloads.
 * After a full browser restart Chrome/Edge may require a one-time re-grant.
 */
export const handleDB = {
  async saveHandle(key: string, handle: FileSystemDirectoryHandle): Promise<void> {
    const db = await getDB();
    await db.put("handles", { key, handle });
  },

  async getHandle(key: string): Promise<FileSystemDirectoryHandle | undefined> {
    const db  = await getDB();
    const rec = await db.get("handles", key);
    return rec?.handle;
  },

  async deleteHandle(key: string): Promise<void> {
    const db = await getDB();
    await db.delete("handles", key);
  },
};

// ── Credentials persistence ────────────────────────────────────────────────────

/** Typed access to the "auth" store (used exclusively by lib/auth.ts). */
export const authDB = {
  async getCredentials(): Promise<{
    key: string; username: string; hashB64: string;
    saltB64: string; iterations: number; createdAt: string;
  } | undefined> {
    const db = await getDB();
    return db.get("auth", "default");
  },

  async setCredentials(rec: {
    key: string; username: string; hashB64: string;
    saltB64: string; iterations: number; createdAt: string;
  }): Promise<void> {
    const db = await getDB();
    await db.put("auth", rec);
  },
};

// ── Profile persistence ───────────────────────────────────────────────────────

/** Typed access to the "profile" store (used exclusively by lib/profile.ts). */
export const profileDB = {
  async getProfile(): Promise<{
    key: string; doctorName: string | null; specialty: string | null;
    hospital: string | null; lastLoginAt: string | null; updatedAt: string;
  } | undefined> {
    const db = await getDB();
    return db.get("profile", "default");
  },

  async setProfile(rec: {
    key: string; doctorName: string | null; specialty: string | null;
    hospital: string | null; lastLoginAt: string | null; updatedAt: string;
  }): Promise<void> {
    const db = await getDB();
    await db.put("profile", rec);
  },
};
