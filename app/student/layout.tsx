"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
  };

  return (
    <div className="student-shell min-h-screen bg-vakhan-black">
      <header className="sticky top-0 z-40 border-b border-vakhan-light-gray bg-vakhan-black/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between px-4">
          <h1 className="text-xl font-semibold text-white">Vakhán</h1>

          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex min-h-12 min-w-12 items-center justify-center rounded-button border border-vakhan-light-gray text-xl text-gray-300 hover:bg-vakhan-dark-gray hover:text-white md:hidden"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
          >
            ☰
          </button>

          <nav className="hidden items-center gap-2 md:flex">
            <Link href="/student" className="rounded-button px-4 py-2 hover:bg-vakhan-dark-gray">
              Rutina
            </Link>
            <Link
              href="/student/progress"
              className="rounded-button px-4 py-2 hover:bg-vakhan-dark-gray"
            >
              Progreso
            </Link>
            <button
              onClick={handleSignOut}
              className="rounded-button px-4 py-2 text-gray-400 hover:bg-vakhan-dark-gray hover:text-white"
            >
              Salir
            </button>
          </nav>
        </div>

        {menuOpen && (
          <div className="space-y-2 border-t border-vakhan-light-gray bg-vakhan-dark-gray p-4 md:hidden">
            <Link
              href="/student"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-12 items-center rounded-input px-3 hover:bg-vakhan-light-gray"
            >
              Rutina
            </Link>
            <Link
              href="/student/progress"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-12 items-center rounded-input px-3 hover:bg-vakhan-light-gray"
            >
              Progreso
            </Link>
            <button
              onClick={handleSignOut}
              className="min-h-12 w-full rounded-input px-3 text-left text-gray-400 hover:bg-vakhan-light-gray hover:text-white"
            >
              Salir
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">{children}</main>
    </div>
  );
}
