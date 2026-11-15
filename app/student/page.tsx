"use client";

import { useEffect, useMemo, useState } from "react";

import { VideoModal } from "@/components/video-modal";
import { studentAction } from "@/lib/api-client";
import { previousLoadKey } from "@/lib/load-history";

interface LoadRecord {
  id: string;
  ejercicio_bloque_id: string;
  mc: number;
  serie: number;
  reps: number | null;
  peso: number | null;
  rir: number | null;
}

interface LoadValues {
  id?: string;
  reps: string;
  peso: string;
  rir: string;
}

interface ExerciseAssignment {
  assignmentId: string;
  exerciseId: string;
  nombre: string;
  categoria: string;
  url_video: string | null;
  dosis: Record<string, string>;
  nota_profesor: string | null;
  notas: Record<string, string>;
}

interface TrainingDay {
  id: string;
  numero: number;
  titulo: string;
  bloques: Array<{
    id: string;
    numero: number;
    titulo: string;
    ejercicios: ExerciseAssignment[];
  }>;
}

interface RoutineView {
  id: string;
  meso: number;
  total_mc: number;
  dias: TrainingDay[];
}

interface RoutineResponse {
  routine: RoutineView | null;
  activeMicrocycle?: number;
  programComplete?: boolean;
  loads?: Record<string, LoadValues>;
  previousLoads?: Record<string, LoadRecord>;
}

type FieldName = "reps" | "peso" | "rir";
type SaveStatus = "incomplete" | "saving" | "saved" | "error";
type NoteSaveStatus = "saving" | "saved" | "error";

function loadKey(assignmentId: string, microcycle: number, series: number) {
  return `${assignmentId}:${microcycle}:${series}`;
}

function parseSeriesCount(dose: string): number | null {
  const match = dose.trim().match(/^(\d+)\s*[x×]/i);
  if (!match) return null;
  const count = Number(match[1]);
  return Number.isInteger(count) && count > 0 ? Math.min(count, 20) : null;
}

function toNumber(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function effortScaleForDose(dose: string): "RIR" | "RPE" | null {
  if (/\bRPE\b/i.test(dose)) return "RPE";
  if (/\bRIR\b/i.test(dose)) return "RIR";
  return null;
}

export default function StudentPage() {
  const [routine, setRoutine] = useState<RoutineView | null>(null);
  const [activeMicrocycle, setActiveMicrocycle] = useState(1);
  const [programComplete, setProgramComplete] = useState(false);
  const [loads, setLoads] = useState<Record<string, LoadValues>>({});
  const [previousLoads, setPreviousLoads] = useState<Record<string, LoadRecord>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
  const [studentNotes, setStudentNotes] = useState<Record<string, string>>({});
  const [noteSaveStatus, setNoteSaveStatus] = useState<Record<string, NoteSaveStatus>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [videoModal, setVideoModal] = useState<{
    url: string;
    exerciseName: string;
  } | null>(null);

  useEffect(() => {
    async function fetchRoutine() {
      try {
        setErrorMessage("");
        const result = await studentAction<RoutineResponse>("routine");
        setRoutine(result.routine);
        setActiveMicrocycle(result.activeMicrocycle ?? 1);
        setProgramComplete(result.programComplete ?? false);
        setLoads(result.loads ?? {});
        setPreviousLoads(result.previousLoads ?? {});
        setSelectedDay(result.routine?.dias[0]?.id ?? null);
        const currentMicrocycle = result.activeMicrocycle ?? 1;
        const initialNotes = Object.fromEntries(
          (result.routine?.dias ?? []).flatMap((day) =>
            day.bloques.flatMap((block) =>
              block.ejercicios.map((exercise) => [
                exercise.assignmentId,
                exercise.notas[String(currentMicrocycle)] ?? "",
              ]),
            ),
          ),
        );
        setStudentNotes(initialNotes);
      } catch (error) {
        console.error("Error al cargar la rutina:", error);
        setErrorMessage(
          error instanceof Error ? error.message : "No se pudo cargar tu rutina.",
        );
      } finally {
        setLoading(false);
      }
    }

    void fetchRoutine();
  }, []);

  function updateLoad(key: string, field: FieldName, value: string) {
    setLoads((current) => ({
      ...current,
      [key]: {
        id: current[key]?.id,
        reps: current[key]?.reps ?? "",
        peso: current[key]?.peso ?? "",
        rir: current[key]?.rir ?? "",
        [field]: value,
      },
    }));
    setSaveStatus((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function saveLoad(
    assignmentId: string,
    series: number,
    effortScale: "RIR" | "RPE" | null,
  ) {
    const key = loadKey(assignmentId, activeMicrocycle, series);
    const values = loads[key];
    const reps = toNumber(values?.reps ?? "");
    const peso = toNumber(values?.peso ?? "");
    const rir = effortScale ? toNumber(values?.rir ?? "") : null;

    if (reps === null && peso === null && rir === null) {
      setSaveStatus((current) => ({ ...current, [key]: "incomplete" }));
      return;
    }

    setSaveStatus((current) => ({ ...current, [key]: "saving" }));
    try {
      const saved = await studentAction<{ id: string }>("loads.save", {
        assignmentId,
        mc: activeMicrocycle,
        serie: series,
        reps,
        peso,
        rir,
      });
      setLoads((current) => ({
        ...current,
        [key]: { ...current[key], id: saved.id },
      }));
      setSaveStatus((current) => ({ ...current, [key]: "saved" }));
    } catch (error) {
      console.error("Error al guardar carga:", error);
      setSaveStatus((current) => ({ ...current, [key]: "error" }));
    }
  }

  function updateStudentNote(assignmentId: string, value: string) {
    setStudentNotes((current) => ({ ...current, [assignmentId]: value }));
    setNoteSaveStatus((current) => {
      const next = { ...current };
      delete next[assignmentId];
      return next;
    });
  }

  async function saveNote(assignmentId: string) {
    const note = studentNotes[assignmentId] ?? "";
    setNoteSaveStatus((current) => ({ ...current, [assignmentId]: "saving" }));
    try {
      const saved = await studentAction<{ note: string }>("notes.save", {
        assignmentId,
        mc: activeMicrocycle,
        nota: note,
      });
      setStudentNotes((current) => ({ ...current, [assignmentId]: saved.note }));
      setNoteSaveStatus((current) => ({ ...current, [assignmentId]: "saved" }));
    } catch (error) {
      console.error("Error al guardar nota:", error);
      setNoteSaveStatus((current) => ({ ...current, [assignmentId]: "error" }));
    }
  }

  const selectedDayData = useMemo(
    () => routine?.dias.find((day) => day.id === selectedDay),
    [routine, selectedDay],
  );

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-b-2 border-vakhan-red" />
        <p className="mt-4 text-sm text-gray-400">Cargando rutina...</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="card mx-auto max-w-xl p-6 text-center">
        <p className="font-semibold text-white">No pudimos cargar tu rutina</p>
        <p className="mt-2 text-sm text-gray-400">{errorMessage}</p>
      </div>
    );
  }

  if (!routine) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg text-gray-300">No hay una rutina asignada.</p>
        <p className="mt-2 text-sm text-gray-500">Contactá a tu entrenador para comenzar.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">
              Mesociclo {routine.meso}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Mi rutina</h1>
          </div>
          <div className="card rounded-card px-4 py-3 text-right">
            <p className="eyebrow">Microciclo activo</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-vakhan-red">
              MC {activeMicrocycle}{" "}
              <span className="text-sm text-gray-500">/ {routine.total_mc}</span>
            </p>
          </div>
        </div>
        {programComplete && (
          <p className="card mt-4 p-4 text-sm text-gray-300">
            Completaste todos los microciclos. Se muestra el último para revisión.
          </p>
        )}
      </header>

      <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-2">
        {routine.dias.map((day) => (
          <button
            key={day.id}
            type="button"
            onClick={() => setSelectedDay(day.id)}
            className={`min-h-12 min-w-32 rounded-button border px-4 py-3 text-left transition-colors ${
              selectedDay === day.id
                ? "border-vakhan-red bg-vakhan-red text-white"
                : "border-vakhan-light-gray bg-transparent text-gray-300 hover:bg-vakhan-dark-gray"
            }`}
          >
            <span className="block text-xs opacity-70">Día {day.numero}</span>
            <span className="mt-1 block truncate text-sm font-semibold">{day.titulo}</span>
          </button>
        ))}
      </div>

      {selectedDayData && (
        <div className="space-y-5">
          {selectedDayData.bloques.map((block) => (
            <section key={block.id}>
              <h2 className="eyebrow mb-3 px-1 text-gray-400">
                {block.titulo}
              </h2>

              <div className="space-y-4">
                {block.ejercicios.map((exercise) => {
                  const dose = exercise.dosis[String(activeMicrocycle)] ?? "";
                  const seriesCount = parseSeriesCount(dose);
                  const effortScale = effortScaleForDose(dose);

                  return (
                    <article
                      key={exercise.assignmentId}
                      className="card overflow-hidden p-4 sm:p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{exercise.nombre}</h3>
                          <p className="eyebrow mt-1">{exercise.categoria}</p>
                        </div>
                        {exercise.url_video && (
                          <button
                            type="button"
                            onClick={() =>
                              setVideoModal({
                                url: exercise.url_video!,
                                exerciseName: exercise.nombre,
                              })
                            }
                            className="btn-secondary shrink-0 px-4"
                          >
                            Ver video
                          </button>
                        )}
                      </div>

                      <div className="my-5 rounded-input border border-vakhan-light-gray bg-vakhan-black px-4 py-3">
                        <p className="eyebrow">Dosis MC {activeMicrocycle}</p>
                        <p className="mt-1 text-sm font-semibold text-gray-200">
                          {dose || "Sin dosis definida"}
                        </p>
                      </div>

                      {exercise.nota_profesor && (
                        <div className="mb-5 rounded-input border border-vakhan-light-gray bg-vakhan-dark-gray px-4 py-3">
                          <p className="eyebrow text-gray-400">Nota del profe</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-200">
                            {exercise.nota_profesor}
                          </p>
                        </div>
                      )}

                      {seriesCount ? (
                        <div>
                          <p className="eyebrow mb-3 text-gray-400">
                            {seriesCount} {seriesCount === 1 ? "serie" : "series"}
                          </p>
                          <div className="space-y-3">
                            {Array.from({ length: seriesCount }, (_, index) => index + 1).map(
                              (series) => {
                                const key = loadKey(exercise.assignmentId, activeMicrocycle, series);
                                const values = loads[key] ?? { reps: "", peso: "", rir: "" };
                                const prior =
                                  activeMicrocycle > 1
                                    ? previousLoads[previousLoadKey(exercise.assignmentId, series)]
                                    : undefined;
                                const status = saveStatus[key];

                                return (
                                  <div
                                    key={series}
                                    className="flex min-h-[230px] flex-col rounded-card border border-vakhan-light-gray bg-vakhan-black p-4"
                                  >
                                    <div className="mb-2 flex items-center justify-between">
                                      <span className="text-sm font-semibold">Serie {series}</span>
                                      <span
                                        className={`text-xs ${
                                          status === "error"
                                            ? "font-medium text-gray-300"
                                            : status === "saved"
                                              ? "font-medium text-white"
                                              : "text-gray-500"
                                        }`}
                                      >
                                        {status === "saving" && "Guardando..."}
                                        {status === "saved" && "\u2713 Guardado"}
                                        {status === "incomplete" && "Ingresá un valor"}
                                        {status === "error" && "\u26a0 Error al guardar"}
                                      </span>
                                    </div>

                                    <div className={`grid gap-2 ${effortScale ? "grid-cols-3" : "grid-cols-2"}`}>
                                      {([
                                        ["reps", "Reps / tiempo"],
                                        ["peso", "Peso kg"],
                                        ...(effortScale
                                          ? [["rir", effortScale] as [FieldName, string]]
                                          : []),
                                      ] as Array<[FieldName, string]>).map(([field, label]) => (
                                        <label key={field} className="eyebrow text-[11px] text-gray-400">
                                          {label}
                                          <input
                                            type="number"
                                            inputMode="decimal"
                                            min={0}
                                            step="any"
                                            value={values[field]}
                                            onChange={(event) =>
                                              updateLoad(key, field, event.target.value)
                                            }
                                            onBlur={() =>
                                              void saveLoad(
                                                exercise.assignmentId,
                                                series,
                                                effortScale,
                                              )
                                            }
                                            className={`input mt-2 min-h-14 px-2 text-center font-semibold tabular-nums ${
                                              field === "rir" ? "text-xl" : "text-2xl"
                                            }`}
                                          />
                                        </label>
                                      ))}
                                    </div>

                                    {prior && (prior.reps !== null || prior.peso !== null) && (
                                      <div className="mt-3 rounded-input border border-vakhan-light-gray bg-vakhan-dark-gray px-3 py-2 text-xs tabular-nums text-gray-300">
                                        Último registro · MC {prior.mc}:
                                        {prior.reps !== null ? ` ${prior.reps} reps` : ""}
                                        {prior.peso !== null ? ` · ${prior.peso} kg` : ""}
                                      </div>
                                    )}

                                    <p className="mt-auto pt-3 text-center text-xs text-gray-500">
                                      Se guarda automáticamente al salir de cada campo.
                                    </p>
                                  </div>
                                );
                              },
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">
                          El entrenador debe comenzar la dosis con la cantidad de series
                          (por ejemplo, 3x30s) para habilitar el registro.
                        </p>
                      )}

                      <div className="mt-5 border-t border-vakhan-light-gray pt-5">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <label
                            htmlFor={`student-note-${exercise.assignmentId}`}
                            className="text-sm font-medium text-gray-200"
                          >
                            Mi nota · MC {activeMicrocycle}
                          </label>
                          <span className="text-xs tabular-nums text-gray-500">
                            {(studentNotes[exercise.assignmentId] ?? "").length}/500
                          </span>
                        </div>
                        <textarea
                          id={`student-note-${exercise.assignmentId}`}
                          value={studentNotes[exercise.assignmentId] ?? ""}
                          onChange={(event) =>
                            updateStudentNote(exercise.assignmentId, event.target.value)
                          }
                          onBlur={() => void saveNote(exercise.assignmentId)}
                          maxLength={500}
                          rows={3}
                          placeholder="Contale al profe cómo te sentiste o qué pasó con este ejercicio."
                          className="w-full resize-y"
                        />
                        <div className="mt-2 flex min-h-12 items-center justify-between gap-3">
                          <span
                            className={`text-xs ${
                              noteSaveStatus[exercise.assignmentId] === "error"
                                ? "text-gray-300"
                                : "text-gray-500"
                            }`}
                          >
                            {noteSaveStatus[exercise.assignmentId] === "saving" && "Guardando..."}
                            {noteSaveStatus[exercise.assignmentId] === "saved" && "✓ Nota guardada"}
                            {noteSaveStatus[exercise.assignmentId] === "error" && "⚠ Error al guardar"}
                          </span>
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => void saveNote(exercise.assignmentId)}
                            disabled={noteSaveStatus[exercise.assignmentId] === "saving"}
                            className="btn-secondary min-w-32"
                          >
                            Guardar nota
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}

                {block.ejercicios.length === 0 && (
                  <p className="py-4 text-center text-sm text-gray-500">
                    Este bloque todavía no tiene ejercicios.
                  </p>
                )}
              </div>
            </section>
          ))}
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
