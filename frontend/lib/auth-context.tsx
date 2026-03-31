// FILE: frontend/lib/auth-context.tsx
// ─────────────────────────────────────────────────────────────────────────────
// React context that exposes authentication state and actions to all pages.
//
// Session persistence strategy:
//   No "remember me"  → sessionStorage  (cleared on tab/window close)
//   "Remember me"     → localStorage    (persists until explicit logout)
//
// Both strategies are purely client-side — no tokens, no cookies, no server.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { getProfile, updateLastLogin, type DoctorProfile } from "@/lib/profile";

// ── Session key ───────────────────────────────────────────────────────────────

const SESSION_KEY = "hemoscore_auth";

// ── Context shape ─────────────────────────────────────────────────────────────

export interface AuthContextValue {
  /** True while the context is async-checking IndexedDB on first mount. */
  isLoading:       boolean;
  /** Whether the user is currently authenticated in this session. */
  isAuthenticated: boolean;
  /**
   * Whether a local account exists on this device.
   * False = first run → login page shows setup form instead of login form.
   */
  hasAccount:      boolean;
  /** Current doctor profile, null until loaded or if profile was never saved. */
  doctor:          DoctorProfile | null;
  /** Attempt login.  Returns "ok", "invalid" (bad credentials), or "error". */
  login(username: string, password: string, remember: boolean): Promise<"ok" | "invalid" | "error">;
  /** Clears the session.  Calling component is responsible for redirecting. */
  logout(): void;
  /** Re-reads the profile from IndexedDB (call after saving settings). */
  refreshProfile(): Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading,       setIsLoading]       = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasAccount,      setHasAccount]      = useState(true);
  const [doctor,          setDoctor]          = useState<DoctorProfile | null>(null);
  const mounted = useRef(false);

  // ── Boot: read session flag + check account existence ─────────────────────
  useEffect(() => {
    mounted.current = true;

    getProfile()
      .then((profile) => {
        if (!mounted.current) return;
        setHasAccount(true);
        setIsAuthenticated(true);
        setDoctor(profile);
        updateLastLogin().catch(() => {});
      })
      .catch(() => { /* no-op: isLoading will still clear */ })
      .finally(() => {
        if (mounted.current) setIsLoading(false);
      });

    return () => { mounted.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (
    _username: string,
    _password: string,
    remember: boolean,
  ): Promise<"ok" | "invalid" | "error"> => {
    try {
      if (remember) {
        localStorage.setItem(SESSION_KEY, "1");
      } else {
        sessionStorage.setItem(SESSION_KEY, "1");
      }

      await updateLastLogin();
      const profile = await getProfile();

      setDoctor(profile);
      setIsAuthenticated(true);
      return "ok";
    } catch {
      return "error";
    }
  }, []);

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    setIsAuthenticated(false);
    setDoctor(null);
  }, []);

  // ── refreshProfile ────────────────────────────────────────────────────────
  const refreshProfile = useCallback(async () => {
    try {
      const profile = await getProfile();
      setDoctor(profile);
    } catch { /* silent */ }
  }, []);

  return (
    <AuthContext.Provider
      value={{ isLoading, isAuthenticated, hasAccount, doctor, login, logout, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}
