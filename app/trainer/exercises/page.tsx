"use client";

import { useEffect, useState } from "react";
import { VideoModal } from "@/components/video-modal";
import { apiAction } from "@/lib/api-client";

interface Ejercicio {
  id: string;
  nombre: string;
  categoria: string;
  url_video: string | null;
}

const PAGE_SIZE = 50;

export default function ExercisesPage() {
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [page, setPage] = useState(1);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ nombre: "", categoria: "", urlVideo: "" });
  const [videoModal, setVideoModal] = useState<{
    url: string;
    exerciseName: string;
  } | null>(null);

  useEffect(() => {
    fetchEjercicios();
  }, []);

  async function fetchEjercicios() {
    try {
      setErrorMessage("");
      const data = await apiAction<Ejercicio[]>("exercises.list");
      setEjercicios(data);
      setCategorias(Array.from(new Set(data.map((exercise) => exercise.categoria))));
    } catch (error) {
      console.error("Error fetching ejercicios:", error);
      setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar los ejercicios.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateExercise(event: React.FormEvent) {
    event.preventDefault();
    if (creating) return;

    setCreating(true);
    setErrorMessage("");
    try {
      await apiAction<Ejercicio>("exercises.create", formData);
      setFormData({ nombre: "", categoria: "", urlVideo: "" });
      setShowForm(false);
      await fetchEjercicios();
    } catch (error) {
      console.error("Error creating ejercicio:", error);
      setErrorMessage(error instanceof Error ? error.message : "No se pudo crear el ejercicio.");
    } finally {
      setCreating(false);
    }
  }

  const ejerciciosFiltrados = filtro
    ? ejercicios.filter((e) => e.categoria === filtro)
    : ejercicios;
  const totalPages = Math.max(1, Math.ceil(ejerciciosFiltrados.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const ejerciciosPagina = ejerciciosFiltrados.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-semibold text-white">
            Biblioteca de Ejercicios
          </h1>
          <p className="text-gray-400">{ejercicios.length} ejercicios disponibles</p>
        </div>
        <button type="button" onClick={() => setShowForm((value) => !value)} className="btn-primary">
          + Nuevo ejercicio
        </button>
      </div>

      {errorMessage && (
        <p className="card mb-6 p-4 text-sm text-gray-300">
          {errorMessage}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleCreateExercise}
          className="card mb-6 p-5"
        >
          <h2 className="text-xl font-semibold text-white">Agregar a la biblioteca</h2>
          <p className="mt-1 text-sm text-gray-400">
            Podés elegir una categoría existente o escribir una nueva.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="eyebrow text-gray-300">
              Nombre
              <input
                value={formData.nombre}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, nombre: event.target.value }))
                }
                placeholder="Nombre del ejercicio"
                className="mt-2 w-full"
                required
              />
            </label>
            <label className="eyebrow text-gray-300">
              Tipo o categoría
              <input
                list="library-exercise-categories"
                value={formData.categoria}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, categoria: event.target.value }))
                }
                placeholder="Ej: Dominante Rodilla"
                className="mt-2 w-full"
                required
              />
              <datalist id="library-exercise-categories">
                {categorias.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </label>
            <label className="eyebrow text-gray-300 md:col-span-2">
              URL del video <span className="font-normal text-gray-500">(opcional)</span>
              <input
                type="url"
                value={formData.urlVideo}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, urlVideo: event.target.value }))
                }
                placeholder="https://youtube.com/..."
                className="mt-2 w-full"
              />
            </label>
          </div>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={creating} className="btn-primary disabled:opacity-50">
              {creating ? "Guardando..." : "Guardar ejercicio"}
            </button>
          </div>
        </form>
      )}

      <div className="mb-6">
        <select
          value={filtro}
          onChange={(e) => {
            setFiltro(e.target.value);
            setPage(1);
          }}
          className="w-full md:w-64"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-vakhan-red"></div>
        </div>
      ) : (
        <div className="grid gap-4">
          {ejerciciosPagina.map((ejercicio) => (
            <div
              key={ejercicio.id}
              className="card px-4 py-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="mb-2 font-semibold text-white">
                    {ejercicio.nombre}
                  </h3>
                  <span className="rounded-input border border-vakhan-light-gray bg-vakhan-black px-2 py-1 text-xs text-gray-400">
                    {ejercicio.categoria}
                  </span>
                </div>
                {ejercicio.url_video && (
                  <button
                    type="button"
                    onClick={() =>
                      setVideoModal({
                        url: ejercicio.url_video!,
                        exerciseName: ejercicio.nombre,
                      })
                    }
                    className="btn-secondary shrink-0 px-4"
                  >
                    Ver video
                  </button>
                )}
              </div>
            </div>
          ))}
          {ejerciciosFiltrados.length === 0 && (
            <p className="card p-5 text-gray-400">
              {"No hay ejercicios para esta categor\u00eda."}
            </p>
          )}
        </div>
      )}

      {!loading && ejerciciosFiltrados.length > PAGE_SIZE && (
        <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Paginacion">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={currentPage === 1}
            className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-400">
            {"P\u00e1gina"} {currentPage} de {totalPages} &middot; {ejerciciosFiltrados.length}{" "}
            ejercicios
          </span>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={currentPage === totalPages}
            className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Siguiente
          </button>
        </nav>
      )}

      {videoModal && (
        <VideoModal
          url={videoModal.url}
          exerciseName={videoModal.exerciseName}
          onClose={() => setVideoModal(null)}
        />
      )}
    </div>
  );
}
