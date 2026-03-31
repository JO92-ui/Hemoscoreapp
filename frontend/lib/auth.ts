// FILE: frontend/lib/auth.ts
// ─────────────────────────────────────────────────────────────────────────────
// Local authentication — PBKDF2 via Web Crypto API.
// All credentials stored in IndexedDB (authDB from lib/db.ts).
//
// Algorithm: PBKDF2-SHA-256, 200 000 iterations, 128-bit random salt.
// Comparison: constant-time (timing-safe) to mitigate timing attacks.
//
// No internet, no external services, no cleartext passwords stored anywhere.
// ─────────────────────────────────────────────────────────────────────────────

import { authDB } from "@/lib/db";

const PBKDF2_ITERATIONS = 200_000;

// ── Internal crypto helpers ───────────────────────────────────────────────────

async function deriveHash(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new Uint8Array(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return new Uint8Array(bits);
}

function b64encode(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf));
}

function b64decode(str: string): Uint8Array {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

/**
 * Constant-time comparison to mitigate brute-force timing attacks.
 * Returns true only if both arrays have identical content.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns true if a local account has been created on this device. */
export async function hasCredentials(): Promise<boolean> {
  const rec = await authDB.getCredentials();
  return !!rec;
}

/** Returns the stored username, or null if no account exists. */
export async function getUsername(): Promise<string | null> {
  const rec = await authDB.getCredentials();
  return rec?.username ?? null;
}

/**
 * Creates the local account.  Should only be called once (first run).
 * Generates a fresh random salt and derives the PBKDF2 hash.
 */
export async function createCredentials(username: string, password: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveHash(password, salt);
  await authDB.setCredentials({
    key:        "default",
    username:   username.trim(),
    hashB64:    b64encode(hash),
    saltB64:    b64encode(salt),
    iterations: PBKDF2_ITERATIONS,
    createdAt:  new Date().toISOString(),
  });
}

/**
 * Verifies the supplied username + password.
 * Returns a discriminated result so the caller can show a precise error.
 */
export async function verifyCredentials(
  username: string,
  password: string,
): Promise<"ok" | "wrong_user" | "wrong_pass" | "no_account"> {
  const rec = await authDB.getCredentials();
  if (!rec)                              return "no_account";
  if (rec.username !== username.trim()) return "wrong_user";
  const salt     = b64decode(rec.saltB64);
  const stored   = b64decode(rec.hashB64);
  const computed = await deriveHash(password, salt);
  return timingSafeEqual(computed, stored) ? "ok" : "wrong_pass";
}

/**
 * Changes the password after verifying the old one.
 * Returns false if the old password is wrong.
 */
export async function changePassword(
  username:    string,
  oldPassword: string,
  newPassword: string,
): Promise<boolean> {
  const result = await verifyCredentials(username, oldPassword);
  if (result !== "ok") return false;
  const rec = await authDB.getCredentials();
  if (!rec) return false;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveHash(newPassword, salt);
  await authDB.setCredentials({
    ...rec,
    hashB64: b64encode(hash),
    saltB64: b64encode(salt),
  });
  return true;
}

/**
 * Changes the username after verifying the current password.
 * Returns false if the password is wrong.
 */
export async function changeUsername(
  currentPassword: string,
  newUsername:     string,
): Promise<boolean> {
  const rec = await authDB.getCredentials();
  if (!rec) return false;
  const salt     = b64decode(rec.saltB64);
  const stored   = b64decode(rec.hashB64);
  const computed = await deriveHash(currentPassword, salt);
  if (!timingSafeEqual(computed, stored)) return false;
  await authDB.setCredentials({ ...rec, username: newUsername.trim() });
  return true;
}
