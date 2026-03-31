// FILE: frontend/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

/**
 * Inter is fetched at build time and self-hosted — no CDN request at runtime.
 * This makes the app fully functional offline once built.
 */
const inter = Inter({
  subsets:  ["latin"],
  weight:   ["300", "400", "500", "600", "700", "800"],
  display:  "swap",
});

export const metadata: Metadata = {
  title: "HEMOSCOREAPP — Cardiogenic Shock Risk",
  description:
    "PULSAR XGBoost model for in-hospital mortality risk stratification in cardiogenic shock. For research and clinical decision support — not a substitute for clinical judgement.",
  keywords: ["cardiogenic shock", "PULSAR", "risk score", "SCAI", "ICU"],
  authors: [{ name: "HEMOSCOREAPP" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1929",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-[#0b1929] text-slate-100 antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
