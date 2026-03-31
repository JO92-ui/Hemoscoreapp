// FILE: frontend/tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette — deep ocean blue
        brand: {
          50:  "#eef4ff",
          100: "#dce9fe",
          200: "#b2d0fd",
          300: "#7aadfc",
          400: "#3f81f8",
          500: "#1a5feb",
          600: "#0d47d0",
          700: "#0e38a8",
          800: "#113088",   // unused — kept for scale
          900: "#152e75",
          950: "#0d1f4e",
        },
        // Deep teal / petroleum blue — main surface colours
        navy: {
          50:  "#edf2f7",
          100: "#c9d8e8",
          200: "#97b4cf",
          300: "#5e8fb5",
          400: "#2d6a9a",
          500: "#1a4f78",
          600: "#143d5f",
          700: "#0f2d47",
          800: "#091f32",
          900: "#06131f",
          950: "#030c15",
        },
        // Surfaces
        surface: {
          DEFAULT: "#0b1929",   // page background
          card:    "#0f2236",   // card background
          border:  "#1a3a57",   // card border
          input:   "#081524",   // input background
          hover:   "#152e47",   // hover state
        },
        // Risk tiers
        risk: {
          low:      { DEFAULT: "#22c55e", muted: "#14532d", text: "#bbf7d0" },
          medium:   { DEFAULT: "#f59e0b", muted: "#78350f", text: "#fde68a" },
          high:     { DEFAULT: "#ef4444", muted: "#7f1d1d", text: "#fecaca" },
          veryhigh: { DEFAULT: "#b91c1c", muted: "#450a0a", text: "#fca5a5" },
        },
        // Semantic
        success: "#22c55e",
        warning: "#f59e0b",
        danger:  "#ef4444",
        muted:   "#64748b",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      borderRadius: {
        xl:  "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,0.5), 0 1px 2px -1px rgba(0,0,0,0.5)",
        "card-hover":
          "0 4px 12px 0 rgba(0,0,0,0.6), 0 2px 4px -2px rgba(0,0,0,0.5)",
        glow:        "0 0 20px rgba(26, 95, 235, 0.25)",
        "glow-amber":"0 0 20px rgba(245, 158, 11, 0.25)",
        "glow-red":  "0 0 20px rgba(239, 68, 68, 0.25)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in":    "fadeIn 0.4s ease-out",
        "slide-up":   "slideUp 0.4s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
