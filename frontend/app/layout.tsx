// FILE: frontend/app/layout.tsx
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

// Bundle the existing Inter Latin font so offline builds need no font CDN.
const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HEMOSCOREAPP — Cardiogenic Shock Risk",
  description:
    "Research prototype for retrospective PULSAR in-hospital mortality estimates in cardiogenic shock.",
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
