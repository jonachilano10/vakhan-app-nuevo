"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { VideoModal } from "@/components/video-modal";
import { StudentAccessControl } from "@/components/student-access-control";
import { apiAction } from "@/lib/api-client";
import { parseSeriesCount } from "@/lib/training-progress";

interface RoutineSummary {
  id: string;
  meso: number;
  total_mc: number;
  activa: boolean;
  created_at: string;
}

interface DetailLoad {
  serie: number;
  reps: number | null;
  peso: number | null;
  rir: number | null;
  updated_by: string | null;
}

interface LoadDraft {
  reps: string;
  peso: string;
  rir: string;
}

interface DetailExercise {
  id: string;
  ejercicio: { id: string; nombre: string; categoria: string; url_video: string | null };
  dosis: Record<string, string>;
  nota_profesor: string | null;
  cargas_por_mc: Record<string, DetailLoad[]>;
  notas_por_mc: Record<string, string>;
}

interface StudentDetail {
  student: { id: string; nombre: string; email: string | null; activo: boolean };
  routines: RoutineSummary[];
  selectedRoutine: RoutineSummary | null;
  days: Array<{
    id: string;
    numero: number;
    titulo: string;
    bloques: Array<{ id: string; numero: number; titulo: string; ejercicios: DetailExercise[] }>;
  }>;
}

export default function StudentLoadsPage() {
  const params = useParams<{ id: string }>();
  const studentId = params.id;
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [microcycle, setMicrocycle] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [videoModal, setVideoModal] = useState<{ url: string; exerciseName: string } | null>(null);
  const [loadDrafts, setLoadDrafts] = useState<Record<string, LoadDraft>>({});
  const [loadFeedback, setLoadFeedback] = useState<Record<string, string>>({});
  const [teacherEdited, setTeacherEdited] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function fetchDetail(routineId?: string) {
    setLoading(true);
    setErrorMessage("");
    try {
      const result = await apiAction<StudentDetail>("students.detail", {
        alumnoId: studentId,
        ...(routineId ? { rutinaId: routineId } : {}),
      });
      setDetail(result);
      setMicrocycle((current) => Math.min(current, result.selectedRoutine?.total_mc ?? 1));
    } catch (error) {
      console.error("Error al cargar el detalle del alumno:", error);
      setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar las cargas.");
    } finally {
      setLoading(false);
    }
  }

  function draftKey(assignmentId: string, series: number) {
    return `${assignmentId}:${microcycle}:${series}`;
  }

  function changeDraft(key: string, load: DetailLoad | undefined, field: keyof LoadDraft, value: string) {
    setLoadDrafts((current) => ({
      ...current,
      [key]: {
        reps: current[key]?.reps ?? String(load?.reps ?? ""),
        peso: current[key]?.peso ?? String(load?.peso ?? ""),
        rir: current[key]?.rir ?? String(load?.rir ?? ""),
        [field]: value,
      },
    }));
    setLoadFeedback((current) => ({ ...current, [key]: "" }));
  }

  async function saveSeries(assignmentId: string, series: number, load?: DetailLoad) {
    const key = draftKey(assignmentId, series);
    const values = loadDrafts[key] ?? {
      reps: String(load?.reps ?? ""),
      peso: String(load?.peso ?? ""),
      rir: String(load?.rir ?? ""),
    };
    const reps = Number(values.reps);
    const peso = Number(values.peso);
    const rir = Number(values.rir);
    if (
      !values.reps || !values.peso || !values.rir ||
      !Number.isFinite(reps) || reps < 0 || reps > 1000 ||
      !Number.isFinite(peso) || peso < 0 || peso > 5000 ||
      !Number.isFinite(rir) || rir < 0 || rir > 10
    ) {
      setLoadFeedback((current) => ({ ...current, [key]: "Revisá reps, peso y RIR (0 a 10)." }));
      return;
    }

    setLoadFeedback((current) => ({ ...current, [key]: "Guardando…" }));
    try {
      await apiAction("loads.save", {
        alumnoId: studentId,
        assignmentId,
        mc: microcycle,
        serie: series,
        reps,
        peso,
        rir,
      });
      setTeacherEdited((current) => ({ ...current, [key]: true }));
      setLoadFeedback((current) => ({ ...current, [key]: "Guardado" }));
    } catch (error) {
      setLoadFeedback((current) => ({
        ...current,
        [key]: error instanceof Error ? error.message : "No se pudo guardar.",
      }));
    }
  }

  if (loading && !detail) {
    return <p className="py-16 text-center text-sm text-gray-400">Cargando cargas...</p>;
  }

  if (errorMessage && !detail) {
    return (
      <div className="card p-6">
        <p className="font-medium text-white">No se pudo cargar el alumno</p>
        <p className="mt-2 text-sm text-gray-400">{errorMessage}</p>
        <Link href="/trainer/students" className="btn-secondary mt-5">Volver a alumnos</Link>
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="max-w-6xl">
      <Link href="/trainer/students" className="text-sm text-gray-400 hover:text-white">
        ← Volver a alumnos
      </Link>
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Cargas del alumno</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">{detail.student.nombre}</h1>
          <p className="mt-1 break-all text-sm text-gray-400">
            {detail.student.email || "Sin correo · acceso mediante QR"}
          </p>
          {detail.student.activo && (
            <div className="mt-4">
              <StudentAccessControl alumnoId={detail.student.id} />
            </div>
          )}
        </div>
        {detail.selectedRoutine && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="eyebrow text-gray-400">
              Rutina
              <select
                value={detail.selectedRoutine.id}
                onChange={(event) => void fetchDetail(event.target.value)}
                disabled={loading}
                className="mt-2 w-full min-w-52"
              >
                {detail.routines.map((routine) => (
                  <option key={routine.id} value={routine.id}>
                    Meso {routine.meso}{routine.activa ? " · activa" : " · histórica"}
                  </option>
                ))}
              </select>
            </label>
            <label className="eyebrow text-gray-400">
              Microciclo
              <select
                value={microcycle}
                onChange={(event) => setMicrocycle(Number(event.target.value))}
                className="mt-2 w-full min-w-40"
              >
                {Array.from({ length: detail.selectedRoutine.total_mc }, (_, index) => index + 1).map(
                  (value) => <option key={value} value={value}>MC {value}</option>,
                )}
              </select>
            </label>
          </div>
        )}
      </div>

      {errorMessage && <p className="card mt-5 p-4 text-sm text-gray-300">{errorMessage}</p>}

      {!detail.selectedRoutine ? (
        <p className="card mt-6 p-8 text-center text-gray-400">Este alumno no tiene rutinas.</p>
      ) : (
        <div className="mt-7 space-y-7">
          {detail.days.map((day) => (
            <section key={day.id} className="card p-4 sm:p-5">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-vakhan-light-gray bg-vakhan-black text-sm font-semibold">
                  {day.numero}
                </span>
                <h2 className="text-lg font-semibold text-white">{day.titulo}</h2>
              </div>
              <div className="space-y-6">
                {day.bloques.map((block) => (
                  <div key={block.id}>
                    <p className="eyebrow mb-3">{block.titulo}</p>
                    <div className="space-y-4">
                      {block.ejercicios.map((assignment) => {
                        const dose = String(assignment.dosis[String(microcycle)] ?? "");
                        const loads = assignment.cargas_por_mc[String(microcycle)] ?? [];
                        const loadBySeries = new Map(loads.map((load) => [load.serie, load]));
                        const expectedSeries = parseSeriesCount(dose);
                        const rowCount = Math.max(
                          expectedSeries,
                          ...loads.map((load) => load.serie),
                          0,
                        );
                        return (
                          <article key={assignment.id} className="rounded-card border border-vakhan-light-gray bg-vakhan-black p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <h3 className="font-semibold text-white">{assignment.ejercicio.nombre}</h3>
                                <p className="mt-1 text-xs text-gray-500">{assignment.ejercicio.categoria}</p>
                              </div>
                              {assignment.ejercicio.url_video && (
                                <button
                                  type="button"
                                  onClick={() => setVideoModal({
                                    url: assignment.ejercicio.url_video!,
                                    exerciseName: assignment.ejercicio.nombre,
                                  })}
                                  className="btn-secondary px-4"
                                >
                                  Ver video
                                </button>
                              )}
                            </div>

                            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                              <div className="overflow-x-auto rounded-input border border-vakhan-light-gray">
                                <table className="w-full min-w-[680px] text-left text-sm">
                                  <thead className="bg-vakhan-dark-gray text-xs uppercase tracking-label text-gray-500">
                                    <tr>
                                      <th className="px-3 py-2">Serie</th>
                                      <th className="px-3 py-2">Reps</th>
                                      <th className="px-3 py-2">Peso</th>
                                      <th className="px-3 py-2">RIR</th>
                                      <th className="px-3 py-2">Estado</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-vakhan-light-gray">
                                    {Array.from({ length: rowCount }, (_, index) => index + 1).map((series) => {
                                      const load = loadBySeries.get(series);
                                      const key = draftKey(assignment.id, series);
                                      const values = loadDrafts[key] ?? {
                                        reps: String(load?.reps ?? ""),
                                        peso: String(load?.peso ?? ""),
                                        rir: String(load?.rir ?? ""),
                                      };
                                      return (
                                        <tr key={series}>
                                          <td className="px-3 py-2 font-medium text-gray-300">
                                            {series}
                                            {(load?.updated_by || teacherEdited[key]) && (
                                              <span className="mt-1 block text-[10px] font-normal text-gray-500">
                                                editado por el profe
                                              </span>
                                            )}
                                          </td>
                                          {(["reps", "peso", "rir"] as const).map((field) => (
                                            <td key={field} className="px-2 py-2">
                                              <input
                                                type="number"
                                                min={0}
                                                max={field === "rir" ? 10 : field === "peso" ? 5000 : 1000}
                                                step={field === "reps" ? 1 : "any"}
                                                value={values[field]}
                                                onChange={(event) => changeDraft(
                                                  key,
                                                  load,
                                                  field,
                                                  event.target.value,
                                                )}
                                                aria-label={`${field} serie ${series}`}
                                                className="w-24"
                                              />
                                            </td>
                                          ))}
                                          <td className="px-3 py-2">
                                            <button
                                              type="button"
                                              onClick={() => void saveSeries(assignment.id, series, load)}
                                              disabled={loadFeedback[key] === "Guardando…"}
                                              className="btn-secondary px-4 py-2"
                                            >
                                              Guardar
                                            </button>
                                            {loadFeedback[key] && (
                                              <p className={`mt-1 max-w-44 text-xs ${
                                                loadFeedback[key] === "Guardado" ? "text-gray-300" : "text-gray-500"
                                              }`}>
                                                {loadFeedback[key]}
                                              </p>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    {rowCount === 0 && (
                                      <tr><td colSpan={5} className="px-3 py-5 text-center text-gray-500">Sin series previstas ni cargadas.</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                              <div className="rounded-input border border-vakhan-light-gray bg-vakhan-dark-gray p-3">
                                <p className="eyebrow">Dosis prescrita</p>
                                <p className="mt-2 text-sm font-semibold text-gray-200">{dose || "Sin dosis"}</p>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <div className="rounded-input border border-vakhan-light-gray bg-vakhan-dark-gray p-3">
                                <p className="eyebrow">Nota del alumno · MC {microcycle}</p>
                                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-300">
                                  {assignment.notas_por_mc[String(microcycle)] || "Sin nota del alumno."}
                                </p>
                              </div>
                              <div className="rounded-input border border-vakhan-light-gray bg-vakhan-dark-gray p-3">
                                <p className="eyebrow">Nota del profe</p>
                                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-300">
                                  {assignment.nota_profesor || "Sin nota del profesor."}
                                </p>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                      {block.ejercicios.length === 0 && <p className="text-sm text-gray-500">Este bloque no tiene ejercicios.</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {detail.days.length === 0 && <p className="card p-8 text-center text-gray-400">La rutina no tiene días configurados.</p>}
        </div>
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
