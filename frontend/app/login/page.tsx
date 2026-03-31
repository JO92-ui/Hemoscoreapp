// FILE: frontend/app/login/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";


export default function LoginPage() {
  const router = useRouter();
  const { isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) router.replace("/home");
  }, [isLoading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#061018]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1a3a57] border-t-blue-500" />
    </div>
  );
}
