"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/auth/login");
      return;
    }

    const isTrainer = session.user?.role === "trainer";
    router.push(isTrainer ? "/trainer" : "/student");
  }, [session, status, router]);

  return (
    <div className="min-h-screen bg-vakhan-black flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-vakhan-red"></div>
        <p className="mt-4 text-gray-400">Cargando...</p>
      </div>
    </div>
  );
}
