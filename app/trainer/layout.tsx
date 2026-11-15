"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
  };

  return (
    <div className="trainer-shell flex min-h-screen flex-col bg-vakhan-black lg:flex-row">
      <aside className="flex w-full flex-col border-b border-vakhan-light-gray bg-vakhan-dark-gray p-4 lg:min-h-screen lg:w-60 lg:border-b-0 lg:border-r lg:p-5">
        <div className="mb-4 lg:mb-7">
          <h1 className="text-2xl font-semibold text-white">Vakhán</h1>
          <p className="mt-1 text-xs uppercase tracking-label text-gray-500">Panel del entrenador</p>
        </div>

        <nav className="grid grid-cols-4 gap-1 overflow-x-auto lg:flex-1 lg:space-y-1 lg:block">
          <Link href="/trainer" className="block">
            <button className="min-h-10 w-full rounded-input px-2 text-center text-xs text-gray-300 hover:bg-vakhan-light-gray hover:text-white lg:px-3 lg:text-left lg:text-sm">
              Inicio
            </button>
          </Link>
          <Link href="/trainer/students" className="block">
            <button className="min-h-10 w-full rounded-input px-2 text-center text-xs text-gray-300 hover:bg-vakhan-light-gray hover:text-white lg:px-3 lg:text-left lg:text-sm">
              Alumnos
            </button>
          </Link>
          <Link href="/trainer/programs" className="block">
            <button className="min-h-10 w-full rounded-input px-2 text-center text-xs text-gray-300 hover:bg-vakhan-light-gray hover:text-white lg:px-3 lg:text-left lg:text-sm">
              Rutinas
            </button>
          </Link>
          <Link href="/trainer/exercises" className="block">
            <button className="min-h-10 w-full rounded-input px-2 text-center text-xs text-gray-300 hover:bg-vakhan-light-gray hover:text-white lg:px-3 lg:text-left lg:text-sm">
              Ejercicios
            </button>
          </Link>
        </nav>

        <div className="mt-4 hidden border-t border-vakhan-light-gray pt-4 lg:block">
          <p className="mb-3 truncate text-xs text-gray-500">{session?.user?.email}</p>
          <button
            onClick={handleSignOut}
            className="w-full btn-secondary text-sm"
          >
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="p-4 sm:p-6 xl:p-9">{children}</div>
      </main>
    </div>
  );
}
