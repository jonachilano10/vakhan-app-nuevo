import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-vakhan-black flex items-center justify-center">
      <div className="text-center max-w-2xl mx-auto px-4">
        <h1 className="text-5xl font-bold mb-4 text-vakhan-red">Vakhán Center</h1>
        <p className="text-xl text-white mb-8">
          Plataforma de entrenamiento personalizado
        </p>
        <div className="space-y-4">
          <Link href="/auth/login" className="inline-block">
            <button className="btn-primary px-8 py-3 text-lg">
              Iniciar Sesión
            </button>
          </Link>
          <p className="text-gray-400 mt-4">
            Entrena con nosotros y alcanza tus metas
          </p>
        </div>
      </div>
    </main>
  );
}
