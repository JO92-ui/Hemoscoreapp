// FILE: frontend/lib/patient-utils.ts
// ─────────────────────────────────────────────────────────────────────────────
// Pure utility helpers for patient display across the UI.
// No side-effects, no imports from the app — safe to call anywhere.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derives 1–3 privacy-safe initials from a patient name string.
 *
 * Rules:
 *   - Split on whitespace, discard empty tokens.
 *   - 0 tokens (null / empty) → returns "UP"  (Unknown Patient)
 *   - 1 token ("Carlos")      → "C"
 *   - 2 tokens ("Juan Pérez") → "JP"
 *   - 3+ tokens ("María Fernanda López") → first + second + last initial,
 *     deduplicated when first === last index (e.g. exactly 3 → all three).
 *     For very long names (>3 tokens) we take [0], [1], [last]:
 *       "María de la Cruz López" → "MCL"
 *
 * Always uppercase.
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return "UP";
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "UP";
  if (tokens.length === 1) return tokens[0][0].toUpperCase();
  if (tokens.length === 2) {
    return (tokens[0][0] + tokens[1][0]).toUpperCase();
  }
  // 3+ tokens: first, second, last
  const first  = tokens[0][0];
  const second = tokens[1][0];
  const last   = tokens[tokens.length - 1][0];
  // If the name has exactly 3 tokens (first === last token by index 0,1,2)
  // they are always distinct positions, so just join them.
  return (first + second + last).toUpperCase();
}

/**
 * Returns a display label for use in the UI.
 * When name is null/empty returns "Unknown patient".
 */
export function getDisplayName(name: string | null | undefined): string {
  if (!name || !name.trim()) return "Unknown patient";
  return name.trim();
}

/**
 * Returns the risk category label formatted for display.
 */
export function formatRiskCategory(category: string): string {
  switch (category) {
    case "very_high": return "Very High";
    case "high":      return "High";
    case "medium":    return "Medium";
    case "low":       return "Low";
    default:          return category;
  }
}

/**
 * Tailwind text-color class for a risk category.
 */
export function riskCategoryColor(category: string): string {
  switch (category) {
    case "very_high": return "text-red-400";
    case "high":      return "text-orange-400";
    case "medium":    return "text-yellow-400";
    case "low":       return "text-emerald-400";
    default:          return "text-slate-400";
  }
}

/**
 * Tailwind border + bg classes for a risk category badge.
 */
export function riskCategoryBadge(category: string): string {
  switch (category) {
    case "very_high": return "border-red-800/50     bg-red-950/30     text-red-400";
    case "high":      return "border-orange-800/50  bg-orange-950/30  text-orange-400";
    case "medium":    return "border-yellow-800/50  bg-yellow-950/30  text-yellow-400";
    case "low":       return "border-emerald-800/50 bg-emerald-950/30 text-emerald-400";
    default:          return "border-[#1a3a57]      bg-[#0f2236]      text-slate-400";
  }
}

/**
 * Background color class for the initials avatar based on a stable hash of the
 * patient_id — ensures the same patient always gets the same color.
 */
export function avatarBgColor(patientId: string): string {
  const colors = [
    "bg-blue-700",
    "bg-teal-700",
    "bg-indigo-700",
    "bg-violet-700",
    "bg-sky-700",
    "bg-cyan-700",
  ];
  let hash = 0;
  for (let i = 0; i < patientId.length; i++) {
    hash = (hash * 31 + patientId.charCodeAt(i)) >>> 0;
  }
  return colors[hash % colors.length];
}

/**
 * Short relative-date helper: "today", "yesterday", "N days ago", or formatted date.
 */
export function relativeDate(iso: string): string {
  try {
    const d     = new Date(iso);
    const now   = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7)  return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return "—";
  }
}
