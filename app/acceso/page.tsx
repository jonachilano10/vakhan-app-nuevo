"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ERROR_MESSAGE = "Este enlace no es válido o venció. Pedile uno nuevo al profe.";

export default function StudentAccessPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function authenticate() {
      const token = window.location.hash.slice(1);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      if (!token) {
        if (active) setError(ERROR_MESSAGE);
        return;
      }

      const result = await signIn("acceso", { token, redirect: false, callbackUrl: "/student" });
      if (!active) return;
      if (!result?.ok) {
        setError(ERROR_MESSAGE);
        return;
      }
      router.replace("/student");
    }

    void authenticate();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-vakhan-black px-5 text-white">
      <section className="card w-full max-w-sm p-6 text-center">
        <h1 className="text-2xl font-semibold text-vakhan-red">Vakhán</h1>
        <p className="mt-4 text-gray-400">
          {error || "Validando tu acceso…"}
        </p>
      </section>
    </main>
  );
}
