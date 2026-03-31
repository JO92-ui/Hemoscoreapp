// FILE: frontend/lib/profile.ts
// ─────────────────────────────────────────────────────────────────────────────
// Doctor profile — stored in IndexedDB (profileDB from lib/db.ts).
// Single record keyed "default", always overwritten on save.
// ─────────────────────────────────────────────────────────────────────────────

import { profileDB } from "@/lib/db";

export interface DoctorProfile {
  doctorName:  string | null;
  specialty:   string | null;
  hospital:    string | null;
  lastLoginAt: string | null;
  updatedAt:   string;
}

/** Returns the doctor profile, or null if it has never been saved. */
export async function getProfile(): Promise<DoctorProfile | null> {
  const rec = await profileDB.getProfile();
  if (!rec) return null;
  return {
    doctorName:  rec.doctorName,
    specialty:   rec.specialty,
    hospital:    rec.hospital,
    lastLoginAt: rec.lastLoginAt,
    updatedAt:   rec.updatedAt,
  };
}

/** Upserts the profile. Unspecified fields retain their existing values. */
export async function saveProfile(
  patch: Partial<Omit<DoctorProfile, "updatedAt">>,
): Promise<void> {
  const existing = await profileDB.getProfile();
  await profileDB.setProfile({
    key:         "default",
    doctorName:  patch.doctorName  !== undefined ? patch.doctorName  : (existing?.doctorName  ?? null),
    specialty:   patch.specialty   !== undefined ? patch.specialty   : (existing?.specialty   ?? null),
    hospital:    patch.hospital    !== undefined ? patch.hospital    : (existing?.hospital    ?? null),
    lastLoginAt: patch.lastLoginAt !== undefined ? patch.lastLoginAt : (existing?.lastLoginAt ?? null),
    updatedAt:   new Date().toISOString(),
  });
}

/** Stamps the current timestamp as lastLoginAt without touching other fields. */
export async function updateLastLogin(): Promise<void> {
  await saveProfile({ lastLoginAt: new Date().toISOString() });
}
