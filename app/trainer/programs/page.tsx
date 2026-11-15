"use client";

import { useEffect, useMemo, useState } from "react";
import { VideoModal } from "@/components/video-modal";
import { apiAction } from "@/lib/api-client";
import {
  buildDoseProgression,
  DEFAULT_DOSE_PROGRESSION,
  STARTING_DOSE_OPTIONS,
  type DoseProgressionConfig,
  type EffortScale,
} from "@/lib/dose-progression";

interface Alumno {
  id: string;
  nombre: string;
  email: string | null;
}

interface Exercise {
  id: string;
  nombre: string;
  categoria: string;
  url_video: string | null;
}

interface AssignedExercise {
  id: string;
  ejercicio_id: string;
  ejercicio: Exercise;
  dosis: Record<string, string>;
  nota_profesor: string | null;
}

interface TrainingBlock {
  id: string;
  numero: number;
  titulo: string;
  ejercicios: AssignedExercise[];
}

interface TrainingDay {
  id: string;
  numero: number;
  titulo: string;
  bloques: TrainingBlock[];
}

interface Rutina {
  id: string;
  alumno_id: string;
  meso: number;
  total_mc: number;
  dias_semana: number;
  alumno: Alumno;
}

type SaveState = "saving" | "saved" | "error";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function emptyDose(totalMc: number) {
  return Object.fromEntries(
    Array.from({ length: totalMc }, (_, index) => [String(index + 1), ""]),
  );
}

export default function ProgramsPage() {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [rutinas, setRutinas] = useState<Rutina[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlumno, setSelectedAlumno] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Rutina | null>(null);
  const [editorDays, setEditorDays] = useState<TrainingDay[]>([]);
  const [editorLoading, setEditorLoading] = useState(false);
  const [searchByBlock, setSearchByBlock] = useState<Record<string, string>>({});
  const [categoryByBlock, setCategoryByBlock] = useState<Record<string, string>>({});
  const [openSearchBlock, setOpenSearchBlock] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [teacherNoteSaveState, setTeacherNoteSaveState] = useState<Record<string, SaveState>>({});
  const [progressionByExercise, setProgressionByExercise] = useState<
    Record<string, DoseProgressionConfig>
  >({});
  const [progressionModeByExercise, setProgressionModeByExercise] = useState<
    Record<string, "automatic" | "free">
  >({});
  const [newExerciseTarget, setNewExerciseTarget] = useState<{
    dayId: string;
    blockId: string;
  } | null>(null);
  const [newExerciseForm, setNewExerciseForm] = useState({
    nombre: "",
    categoria: "",
    urlVideo: "",
  });
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [newExerciseError, setNewExerciseError] = useState("");
  const [videoModal, setVideoModal] = useState<{
    url: string;
    exerciseName: string;
  } | null>(null);
  const [formData, setFormData] = useState({ meso: 1, total_mc: 4, dias_semana: 4 });

  useEffect(() => {
    void fetchData();
  }, []);

  useEffect(() => {
    function closeSearchOnOutsideClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest("[data-exercise-search]")) setOpenSearchBlock(null);
    }
    document.addEventListener("mousedown", closeSearchOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeSearchOnOutsideClick);
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const data = await apiAction<{
        students: Alumno[];
        routines: Rutina[];
        exercises: Exercise[];
      }>("programs.bootstrap");
      setAlumnos(data.students);
      setExercises(data.exercises);
      setRutinas(data.routines);
    } catch (error) {
      console.error("Error al cargar rutinas:", error);
      alert("No se pudieron cargar las rutinas.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRutina(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedAlumno || creating) return;

    setCreating(true);
    try {
      const createdRoutine = await apiAction<Rutina>("programs.create", {
        alumnoId: selectedAlumno,
        meso: formData.meso,
        totalMc: formData.total_mc,
        diasSemana: formData.dias_semana,
      });
      setShowForm(false);
      setSelectedAlumno("");
      setFormData({ meso: 1, total_mc: 4, dias_semana: 4 });
      await fetchData();
      await openEditor(createdRoutine);
    } catch (error) {
      console.error("Error al crear rutina:", error);
      alert(error instanceof Error ? error.message : "No se pudo crear la rutina.");
    } finally {
      setCreating(false);
    }
  }

  async function openEditor(routine: Rutina) {
    setEditingRoutine(routine);
    setEditorLoading(true);
    setEditorDays([]);
    setSearchByBlock({});
    setCategoryByBlock({});
    setProgressionByExercise({});
    setProgressionModeByExercise({});

    try {
      const serverDays = await apiAction<TrainingDay[]>("programs.open", {
        routineId: routine.id,
      });
      setEditorDays(serverDays);
    } catch (error) {
      console.error("Error al abrir el editor:", error);
      alert("No se pudo abrir el constructor de la rutina.");
      setEditingRoutine(null);
    } finally {
      setEditorLoading(false);
    }
  }

  async function updateDayTitle(dayId: string, titulo: string) {
    const cleaned = titulo.trim() || "Día";
    try {
      await apiAction("programs.updateDayTitle", { dayId, titulo: cleaned });
    } catch (error) {
      console.error("Error al guardar título:", error);
      alert(error instanceof Error ? error.message : "No se pudo guardar el título del día.");
    }
  }

  async function addBlock(dayId: string) {
    const day = editorDays.find((item) => item.id === dayId);
    if (!day || day.bloques.length >= 6) return;

    const numero = Math.max(0, ...day.bloques.map((block) => block.numero)) + 1;
    try {
      const data = await apiAction<TrainingBlock>("programs.addBlock", {
        dayId,
        numero,
        titulo: `Bloque ${numero}`,
      });
      setEditorDays((days) =>
        days.map((item) =>
          item.id === dayId
            ? { ...item, bloques: [...item.bloques, data] }
            : item,
        ),
      );
    } catch (error) {
      console.error("Error al agregar bloque:", error);
      alert(error instanceof Error ? error.message : "No se pudo agregar el bloque.");
    }
  }

  async function updateBlockTitle(blockId: string, titulo: string) {
    const cleaned = titulo.trim() || "Bloque";
    try {
      await apiAction("programs.updateBlockTitle", { blockId, titulo: cleaned });
      setEditorDays((days) =>
        days.map((day) => ({
          ...day,
          bloques: day.bloques.map((block) =>
            block.id === blockId ? { ...block, titulo: cleaned } : block,
          ),
        })),
      );
    } catch (error) {
      console.error("Error al guardar el nombre del bloque:", error);
      alert(error instanceof Error ? error.message : "No se pudo guardar el nombre del bloque.");
    }
  }

  async function removeBlock(dayId: string, blockId: string) {
    const day = editorDays.find((item) => item.id === dayId);
    if (!day || day.bloques.length <= 1) return;
    if (!confirm("¿Eliminar este bloque y sus ejercicios?")) return;

    try {
      await apiAction("programs.removeBlock", { blockId });
    } catch (error) {
      console.error("Error al eliminar bloque:", error);
      alert(error instanceof Error ? error.message : "No se pudo eliminar el bloque.");
      return;
    }

    setEditorDays((days) =>
      days.map((item) =>
        item.id === dayId
          ? { ...item, bloques: item.bloques.filter((block) => block.id !== blockId) }
          : item,
      ),
    );
  }

  async function addExercise(dayId: string, blockId: string, exercise: Exercise) {
    if (!editingRoutine) return false;

    let data: AssignedExercise;
    try {
      data = await apiAction<AssignedExercise>("programs.addExercise", {
        blockId,
        exerciseId: exercise.id,
        totalMc: editingRoutine.total_mc,
      });
    } catch (error) {
      console.error("Error al agregar ejercicio:", error);
      alert(error instanceof Error ? error.message : "No se pudo agregar el ejercicio.");
      return false;
    }

    setEditorDays((days) =>
      days.map((day) =>
        day.id === dayId
          ? {
              ...day,
              bloques: day.bloques.map((block) =>
                block.id === blockId
                  ? {
                      ...block,
                      ejercicios: [...block.ejercicios, data],
                    }
                  : block,
              ),
            }
          : day,
      ),
    );
    setSearchByBlock((current) => ({ ...current, [blockId]: "" }));
    setOpenSearchBlock(null);
    return true;
  }

  function openNewExercise(dayId: string, blockId: string) {
    setNewExerciseTarget({ dayId, blockId });
    setNewExerciseForm({
      nombre: "",
      categoria: categoryByBlock[blockId] ?? "",
      urlVideo: "",
    });
    setNewExerciseError("");
  }

  async function createAndAssignExercise(event: React.FormEvent) {
    event.preventDefault();
    if (!newExerciseTarget || creatingExercise) return;

    setCreatingExercise(true);
    setNewExerciseError("");
    try {
      const created = await apiAction<Exercise>("exercises.create", newExerciseForm);
      setExercises((current) =>
        [...current, created].sort((first, second) =>
          first.nombre.localeCompare(second.nombre, "es"),
        ),
      );
      const assigned = await addExercise(
        newExerciseTarget.dayId,
        newExerciseTarget.blockId,
        created,
      );
      if (!assigned) {
        setNewExerciseError(
          "El ejercicio se guardó en la biblioteca, pero no se pudo agregar al bloque. Buscalo por su nombre para intentarlo nuevamente.",
        );
        return;
      }
      setCategoryByBlock((current) => ({
        ...current,
        [newExerciseTarget.blockId]: created.categoria,
      }));
      setNewExerciseTarget(null);
    } catch (error) {
      console.error("Error al crear ejercicio:", error);
      setNewExerciseError(
        error instanceof Error ? error.message : "No se pudo crear el ejercicio.",
      );
    } finally {
      setCreatingExercise(false);
    }
  }

  async function removeExercise(dayId: string, blockId: string, assignedId: string) {
    try {
      await apiAction("programs.removeExercise", { assignedId });
    } catch (error) {
      console.error("Error al quitar ejercicio:", error);
      alert(error instanceof Error ? error.message : "No se pudo quitar el ejercicio.");
      return;
    }

    setEditorDays((days) =>
      days.map((day) =>
        day.id === dayId
          ? {
              ...day,
              bloques: day.bloques.map((block) =>
                block.id === blockId
                  ? {
                      ...block,
                      ejercicios: block.ejercicios.filter(
                        (exercise) => exercise.id !== assignedId,
                      ),
                    }
                  : block,
              ),
            }
          : day,
      ),
    );
  }

  function changeDose(
    dayId: string,
    blockId: string,
    assignedId: string,
    microcycle: number,
    value: string,
  ) {
    setEditorDays((days) =>
      days.map((day) =>
        day.id === dayId
          ? {
              ...day,
              bloques: day.bloques.map((block) =>
                block.id === blockId
                  ? {
                      ...block,
                      ejercicios: block.ejercicios.map((assigned) =>
                        assigned.id === assignedId
                          ? {
                              ...assigned,
                              dosis: { ...assigned.dosis, [String(microcycle)]: value },
                            }
                          : assigned,
                      ),
                    }
                  : block,
              ),
            }
          : day,
      ),
    );
    setSaveState((current) => {
      const next = { ...current };
      delete next[assignedId];
      return next;
    });
  }

  async function saveDose(assignedId: string, dosis: Record<string, string>) {
    setSaveState((current) => ({ ...current, [assignedId]: "saving" }));
    try {
      await apiAction("programs.saveDose", { assignedId, dosis });
      setSaveState((current) => ({ ...current, [assignedId]: "saved" }));
    } catch (error) {
      setSaveState((current) => ({ ...current, [assignedId]: "error" }));
      console.error("Error al guardar dosis:", error);
    }
  }

  function changeTeacherNote(
    dayId: string,
    blockId: string,
    assignedId: string,
    value: string,
  ) {
    setEditorDays((days) =>
      days.map((day) =>
        day.id === dayId
          ? {
              ...day,
              bloques: day.bloques.map((block) =>
                block.id === blockId
                  ? {
                      ...block,
                      ejercicios: block.ejercicios.map((assigned) =>
                        assigned.id === assignedId
                          ? { ...assigned, nota_profesor: value }
                          : assigned,
                      ),
                    }
                  : block,
              ),
            }
          : day,
      ),
    );
    setTeacherNoteSaveState((current) => {
      const next = { ...current };
      delete next[assignedId];
      return next;
    });
  }

  async function saveTeacherNote(assignedId: string, note: string | null) {
    setTeacherNoteSaveState((current) => ({ ...current, [assignedId]: "saving" }));
    try {
      const result = await apiAction<{ nota_profesor: string | null }>(
        "programs.saveTeacherNote",
        { assignedId, nota: note ?? "" },
      );
      setEditorDays((days) =>
        days.map((day) => ({
          ...day,
          bloques: day.bloques.map((block) => ({
            ...block,
            ejercicios: block.ejercicios.map((assigned) =>
              assigned.id === assignedId
                ? { ...assigned, nota_profesor: result.nota_profesor }
                : assigned,
            ),
          })),
        })),
      );
      setTeacherNoteSaveState((current) => ({ ...current, [assignedId]: "saved" }));
    } catch (error) {
      console.error("Error al guardar nota para el alumno:", error);
      setTeacherNoteSaveState((current) => ({ ...current, [assignedId]: "error" }));
    }
  }

  function changeProgression(
    assignedId: string,
    changes: Partial<DoseProgressionConfig>,
  ) {
    setProgressionByExercise((current) => ({
      ...current,
      [assignedId]: {
        ...(current[assignedId] ?? DEFAULT_DOSE_PROGRESSION),
        ...changes,
      },
    }));
  }

  function progressionFor(assignedId: string) {
    return progressionByExercise[assignedId] ?? DEFAULT_DOSE_PROGRESSION;
  }

  function applyProgression(dayId: string, blockId: string, assignedId: string) {
    if (!editingRoutine) return;

    const config = progressionByExercise[assignedId] ?? DEFAULT_DOSE_PROGRESSION;
    const dosis = buildDoseProgression(editingRoutine.total_mc, config);
    setEditorDays((days) =>
      days.map((day) =>
        day.id === dayId
          ? {
              ...day,
              bloques: day.bloques.map((block) =>
                block.id === blockId
                  ? {
                      ...block,
                      ejercicios: block.ejercicios.map((assigned) =>
                        assigned.id === assignedId ? { ...assigned, dosis } : assigned,
                      ),
                    }
                  : block,
              ),
            }
          : day,
      ),
    );
    void saveDose(assignedId, dosis);
  }

  const routineCountLabel = useMemo(
    () => `${rutinas.length} ${rutinas.length === 1 ? "rutina" : "rutinas"}`,
    [rutinas.length],
  );
  const categories = useMemo(
    () =>
      Array.from(new Set(exercises.map((exercise) => exercise.categoria))).sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
    [exercises],
  );

  if (editingRoutine) {
    return (
      <div className="max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => setEditingRoutine(null)}
              className="mb-3 text-sm text-gray-400 hover:text-white"
            >
              ← Volver a rutinas
            </button>
            <h1 className="text-3xl font-semibold text-white">Constructor de rutina</h1>
            <p className="mt-1 text-sm text-gray-400">
              {editingRoutine.alumno.nombre} · Meso {editingRoutine.meso} · {editingRoutine.total_mc} MC
            </p>
          </div>
          <div className="card px-4 py-3 text-sm text-gray-300">
            Los títulos y las dosis se guardan al salir del campo.
          </div>
        </div>

        {editorLoading ? (
          <div className="py-16 text-center text-gray-400">Cargando constructor...</div>
        ) : (
          <div className="space-y-8">
            {editorDays.map((day) => (
              <section
                key={day.id}
                className="card p-4 sm:p-5"
              >
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-vakhan-light-gray bg-vakhan-black font-semibold text-gray-300">
                      {day.numero}
                    </span>
                    <input
                      aria-label={`Título del día ${day.numero}`}
                      value={day.titulo}
                      onChange={(event) =>
                        setEditorDays((days) =>
                          days.map((item) =>
                            item.id === day.id ? { ...item, titulo: event.target.value } : item,
                          ),
                        )
                      }
                      onBlur={(event) => void updateDayTitle(day.id, event.target.value)}
                      className="input w-full text-lg font-semibold sm:w-72"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void addBlock(day.id)}
                    disabled={day.bloques.length >= 6}
                    className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    + Agregar bloque ({day.bloques.length}/6)
                  </button>
                </div>

                <div className="space-y-5">
                  {day.bloques.map((block) => {
                    const term = searchByBlock[block.id] ?? "";
                    const normalizedTerm = normalize(term.trim());
                    const selectedCategory = categoryByBlock[block.id] ?? "";
                    const assignedIds = new Set(
                      block.ejercicios.map((assigned) => assigned.ejercicio_id),
                    );
                    const showMatches = openSearchBlock === block.id;
                    const matches = exercises
                      .filter(
                        (exercise) =>
                          !assignedIds.has(exercise.id) &&
                          (!selectedCategory || exercise.categoria === selectedCategory) &&
                          (!normalizedTerm ||
                            normalize(exercise.nombre).includes(normalizedTerm) ||
                            normalize(exercise.categoria).includes(normalizedTerm)),
                      )
                      .slice(0, 20);

                    return (
                      <article
                        key={block.id}
                        className="rounded-card border border-vakhan-light-gray bg-vakhan-black p-4"
                      >
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <input
                            aria-label={`Nombre del bloque ${block.numero}`}
                            value={block.titulo}
                            onChange={(event) =>
                              setEditorDays((days) =>
                                days.map((item) => ({
                                  ...item,
                                  bloques: item.bloques.map((candidate) =>
                                    candidate.id === block.id
                                      ? { ...candidate, titulo: event.target.value }
                                      : candidate,
                                  ),
                                })),
                              )
                            }
                            onBlur={(event) =>
                              void updateBlockTitle(block.id, event.target.value)
                            }
                            className="input max-w-sm text-lg font-semibold"
                          />
                          <button
                            type="button"
                            onClick={() => void removeBlock(day.id, block.id)}
                            disabled={day.bloques.length <= 1}
                            className="text-xs text-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            Eliminar bloque
                          </button>
                        </div>

                        <div className="mb-5" data-exercise-search>
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-gray-300">
                              Ejercicios del bloque ({block.ejercicios.length})
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                setOpenSearchBlock((current) =>
                                  current === block.id ? null : block.id,
                                )
                              }
                              className="btn-primary whitespace-nowrap"
                            >
                              + Agregar ejercicio
                            </button>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto]">
                            <select
                              aria-label={`Categoría de ejercicios del bloque ${block.numero}`}
                              value={selectedCategory}
                              onChange={(event) => {
                                setOpenSearchBlock(block.id);
                                setCategoryByBlock((current) => ({
                                  ...current,
                                  [block.id]: event.target.value,
                                }));
                              }}
                              onFocus={() => setOpenSearchBlock(block.id)}
                              className="w-full"
                            >
                              <option value="">Todos los tipos</option>
                              {categories.map((category) => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                            </select>
                            <input
                              type="search"
                              value={term}
                              onChange={(event) => {
                                setOpenSearchBlock(block.id);
                                setSearchByBlock((current) => ({
                                  ...current,
                                  [block.id]: event.target.value,
                                }));
                              }}
                              onFocus={() => setOpenSearchBlock(block.id)}
                              placeholder="Buscar ejercicio por nombre..."
                              className="w-full"
                            />
                            <button
                              type="button"
                              onClick={() => openNewExercise(day.id, block.id)}
                              className="btn-secondary whitespace-nowrap"
                            >
                              Crear en biblioteca
                            </button>
                          </div>
                          <div className="relative">
                          {showMatches && (
                            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-input border border-vakhan-light-gray bg-vakhan-dark-gray">
                              {matches.length > 0 ? (
                                matches.map((exercise) => (
                                  <button
                                    key={exercise.id}
                                    type="button"
                                    onClick={() => void addExercise(day.id, block.id, exercise)}
                                    className="flex w-full items-start justify-between gap-3 border-b border-vakhan-light-gray px-4 py-3 text-left last:border-0 hover:bg-vakhan-light-gray"
                                  >
                                    <span>{exercise.nombre}</span>
                                    <span className="shrink-0 text-xs font-normal text-gray-400">
                                      {exercise.categoria}
                                    </span>
                                  </button>
                                ))
                              ) : (
                                <p className="px-4 py-3 text-sm text-gray-400">Sin resultados.</p>
                              )}
                            </div>
                          )}
                          </div>
                        </div>

                        <div className="space-y-4">
                          {block.ejercicios.length === 0 && (
                            <p className="rounded-input border border-dashed border-vakhan-light-gray p-4 text-sm text-gray-500">
                              Busca un ejercicio para agregarlo a este bloque.
                            </p>
                          )}
                          {block.ejercicios.map((assigned) => (
                            <div
                              key={assigned.id}
                              className="card rounded-card p-4"
                            >
                              <div className="mb-4 flex items-start justify-between gap-3">
                                <div>
                                  <h3 className="font-semibold text-white">{assigned.ejercicio.nombre}</h3>
                                  <p className="mt-1 text-xs text-gray-400">
                                    {assigned.ejercicio.categoria}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-3">
                                  {assigned.ejercicio.url_video && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setVideoModal({
                                          url: assigned.ejercicio.url_video!,
                                          exerciseName: assigned.ejercicio.nombre,
                                        })
                                      }
                                      className="btn-secondary px-4"
                                    >
                                      Ver video
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void removeExercise(day.id, block.id, assigned.id)
                                    }
                                    className="text-xs text-gray-500 hover:text-white"
                                  >
                                    Quitar
                                  </button>
                                </div>
                              </div>

                              <div className="mb-4 rounded-input border border-vakhan-light-gray bg-vakhan-black/40 p-3">
                                <label className="mb-3 block text-xs text-gray-400">
                                  Tipo de progresión
                                  <select
                                    value={progressionModeByExercise[assigned.id] ?? "automatic"}
                                    onChange={(event) =>
                                      setProgressionModeByExercise((current) => ({
                                        ...current,
                                        [assigned.id]: event.target.value as "automatic" | "free",
                                      }))
                                    }
                                    className="mt-1 w-full max-w-xs text-sm"
                                  >
                                    <option value="automatic">Automática por repeticiones</option>
                                    <option value="free">Libre (tiempo o repeticiones)</option>
                                  </select>
                                </label>
                                {(progressionModeByExercise[assigned.id] ?? "automatic") === "automatic" ? (
                                  <>
                                <div className="mb-3">
                                  <p className="text-sm font-medium text-white">Progresión automática</p>
                                  <p className="mt-1 text-xs text-gray-500">
                                    MC4 repite las repeticiones de MC3 con 4 series. MC5 usa 2 series y vuelve a aumentar.
                                  </p>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                                  <label className="text-xs text-gray-400">
                                    Inicio
                                    <select
                                      value={`${progressionFor(assigned.id).startMinReps}-${progressionFor(assigned.id).startMaxReps}`}
                                      onChange={(event) => {
                                        const [startMinReps, startMaxReps] = event.target.value
                                          .split("-")
                                          .map(Number);
                                        changeProgression(assigned.id, {
                                          startMinReps,
                                          startMaxReps,
                                        });
                                      }}
                                      className="mt-1 w-full text-sm"
                                    >
                                      {STARTING_DOSE_OPTIONS.map((option) => (
                                        <option key={option.label} value={`${option.min}-${option.max}`}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  <label className="text-xs text-gray-400">
                                    Aumento por MC
                                    <select
                                      value={progressionFor(assigned.id).increment}
                                      onChange={(event) =>
                                        changeProgression(assigned.id, {
                                          increment: Number(event.target.value) as 1 | 2 | 3,
                                        })
                                      }
                                      className="mt-1 w-full text-sm"
                                    >
                                      <option value={1}>+1 repetición</option>
                                      <option value={2}>+2 repeticiones</option>
                                      <option value={3}>+3 repeticiones</option>
                                    </select>
                                  </label>

                                  <label className="text-xs text-gray-400">
                                    Esfuerzo
                                    <select
                                      value={progressionFor(assigned.id).effortScale}
                                      onChange={(event) =>
                                        changeProgression(assigned.id, {
                                          effortScale: event.target.value as EffortScale,
                                        })
                                      }
                                      className="mt-1 w-full text-sm"
                                    >
                                      <option value="RIR">RIR</option>
                                      <option value="RPE">RPE</option>
                                      <option value="NONE">Sin RIR/RPE</option>
                                    </select>
                                  </label>

                                  {progressionFor(assigned.id).effortScale !== "NONE" && (
                                  <label className="text-xs text-gray-400">
                                    Valor {progressionFor(assigned.id).effortScale}
                                    <input
                                      type="number"
                                      min={progressionFor(assigned.id).effortScale === "RPE" ? 1 : 0}
                                      max={10}
                                      step="0.5"
                                      value={progressionFor(assigned.id).effortValue}
                                      onChange={(event) =>
                                        changeProgression(assigned.id, {
                                          effortValue: Number(event.target.value),
                                        })
                                      }
                                      className="mt-1 w-full text-sm"
                                    />
                                  </label>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      applyProgression(day.id, block.id, assigned.id)
                                    }
                                    className="btn-secondary self-end"
                                  >
                                    Aplicar progresión
                                  </button>
                                </div>
                                  </>
                                ) : (
                                  <div className="rounded-input border border-dashed border-vakhan-light-gray p-3 text-sm text-gray-400">
                                    Escribí libremente la dosis de cada MC abajo. Ejemplos: 3x30s, 4x20,
                                    2x15-20 o 10 minutos. Para habilitar el registro por series, comenzá
                                    la dosis con la cantidad de series (por ejemplo, 3x30s).
                                  </div>
                                )}
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                {Array.from(
                                  { length: editingRoutine.total_mc },
                                  (_, index) => index + 1,
                                ).map((microcycle) => (
                                  <label key={microcycle} className="text-xs text-gray-400">
                                    MC {microcycle}
                                    <input
                                      value={assigned.dosis[String(microcycle)] ?? ""}
                                      onChange={(event) =>
                                        changeDose(
                                          day.id,
                                          block.id,
                                          assigned.id,
                                          microcycle,
                                          event.target.value,
                                        )
                                      }
                                      onBlur={() => void saveDose(assigned.id, assigned.dosis)}
                                      placeholder="Ej: 3x4-6 RIR3 o 3x30s"
                                      className="mt-1 w-full text-sm"
                                    />
                                  </label>
                                ))}
                              </div>
                              <p
                                className={`mt-2 min-h-4 text-right text-xs ${
                                  saveState[assigned.id] === "error"
                                    ? "text-gray-300"
                                    : "text-gray-500"
                                }`}
                              >
                                {saveState[assigned.id] === "saving" && "Guardando..."}
                                {saveState[assigned.id] === "saved" && "Guardado"}
                                {saveState[assigned.id] === "error" && "Error al guardar"}
                              </p>

                              <div className="mt-4 border-t border-vakhan-light-gray pt-4">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                  <label
                                    htmlFor={`teacher-note-${assigned.id}`}
                                    className="text-sm font-medium text-gray-200"
                                  >
                                    Nota para el alumno
                                  </label>
                                  <span className="text-xs tabular-nums text-gray-500">
                                    {(assigned.nota_profesor ?? "").length}/500
                                  </span>
                                </div>
                                <textarea
                                  id={`teacher-note-${assigned.id}`}
                                  value={assigned.nota_profesor ?? ""}
                                  onChange={(event) =>
                                    changeTeacherNote(
                                      day.id,
                                      block.id,
                                      assigned.id,
                                      event.target.value,
                                    )
                                  }
                                  onBlur={() =>
                                    void saveTeacherNote(assigned.id, assigned.nota_profesor)
                                  }
                                  maxLength={500}
                                  rows={3}
                                  placeholder="Indicaciones técnicas o recordatorios para este ejercicio."
                                  className="w-full resize-y text-sm"
                                />
                                <p
                                  className={`mt-2 min-h-4 text-right text-xs ${
                                    teacherNoteSaveState[assigned.id] === "error"
                                      ? "text-gray-300"
                                      : "text-gray-500"
                                  }`}
                                >
                                  {teacherNoteSaveState[assigned.id] === "saving" && "Guardando..."}
                                  {teacherNoteSaveState[assigned.id] === "saved" && "Nota guardada"}
                                  {teacherNoteSaveState[assigned.id] === "error" && "Error al guardar la nota"}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {newExerciseTarget && (
          <div
            className="modal-overlay p-4"
            onClick={() => !creatingExercise && setNewExerciseTarget(null)}
          >
            <form
              onSubmit={createAndAssignExercise}
              className="modal-content max-w-lg"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Nuevo ejercicio</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Se guardará en la biblioteca y se agregará a este bloque.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewExerciseTarget(null)}
                  disabled={creatingExercise}
                  className="text-2xl text-gray-400 hover:text-white disabled:opacity-40"
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>

              {newExerciseError && (
                <p className="card mt-4 rounded-card p-3 text-sm text-gray-300">
                  {newExerciseError}
                </p>
              )}

              <div className="mt-5 space-y-4">
                <label className="eyebrow block text-gray-300">
                  Nombre
                  <input
                    value={newExerciseForm.nombre}
                    onChange={(event) =>
                      setNewExerciseForm((current) => ({
                        ...current,
                        nombre: event.target.value,
                      }))
                    }
                    placeholder="Ej: Split squat con mancuerna"
                    className="mt-2 w-full"
                    required
                    autoFocus
                  />
                </label>

                <label className="eyebrow block text-gray-300">
                  Tipo o categoría
                  <input
                    list="routine-exercise-categories"
                    value={newExerciseForm.categoria}
                    onChange={(event) =>
                      setNewExerciseForm((current) => ({
                        ...current,
                        categoria: event.target.value,
                      }))
                    }
                    placeholder="Ej: Dominante Rodilla"
                    className="mt-2 w-full"
                    required
                  />
                  <datalist id="routine-exercise-categories">
                    {categories.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </label>

                <label className="eyebrow block text-gray-300">
                  URL del video <span className="font-normal text-gray-500">(opcional)</span>
                  <input
                    type="url"
                    value={newExerciseForm.urlVideo}
                    onChange={(event) =>
                      setNewExerciseForm((current) => ({
                        ...current,
                        urlVideo: event.target.value,
                      }))
                    }
                    placeholder="https://youtube.com/..."
                    className="mt-2 w-full"
                  />
                </label>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setNewExerciseTarget(null)}
                  disabled={creatingExercise}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingExercise}
                  className="btn-primary disabled:opacity-50"
                >
                  {creatingExercise ? "Creando..." : "Crear y agregar"}
                </button>
              </div>
            </form>
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

  return (
    <div className="max-w-5xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Rutinas</h1>
          <p className="mt-1 text-sm text-gray-400">{routineCountLabel}</p>
        </div>
        <button type="button" onClick={() => setShowForm((value) => !value)} className="btn-primary">
          + Nueva rutina
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreateRutina}
          className="card mb-7 p-5"
        >
          <h2 className="mb-5 text-xl font-semibold">Datos de la rutina</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="eyebrow text-gray-300">
              Alumno
              <select
                value={selectedAlumno}
                onChange={(event) => setSelectedAlumno(event.target.value)}
                required
                className="mt-2 w-full"
              >
                <option value="">Selecciona un alumno</option>
                {alumnos.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="eyebrow text-gray-300">
              Mesociclo
              <input
                type="number"
                min={1}
                value={formData.meso}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, meso: Number(event.target.value) }))
                }
                className="mt-2 w-full"
                required
              />
            </label>

            <label className="eyebrow text-gray-300">
              Total de microciclos
              <input
                type="number"
                min={1}
                max={52}
                value={formData.total_mc}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    total_mc: Number(event.target.value),
                  }))
                }
                className="mt-2 w-full"
                required
              />
            </label>

            <label className="eyebrow text-gray-300">
              Días por semana
              <input
                type="number"
                min={1}
                max={7}
                value={formData.dias_semana}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    dias_semana: Number(event.target.value),
                  }))
                }
                className="mt-2 w-full"
                required
              />
            </label>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button type="submit" disabled={creating} className="btn-primary disabled:opacity-50">
              {creating ? "Creando..." : "Crear y armar rutina"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-400">Cargando rutinas...</div>
      ) : rutinas.length === 0 ? (
        <div className="card border-dashed p-10 text-center text-gray-400">
          Todavía no hay rutinas creadas.
        </div>
      ) : (
        <div className="grid gap-4">
          {rutinas.map((routine) => (
            <article
              key={routine.id}
              className="card px-4 py-3"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-white">{routine.alumno.nombre}</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Meso {routine.meso} · {routine.total_mc} MC · {routine.dias_semana} días/semana
                  </p>
                </div>
                <button type="button" onClick={() => void openEditor(routine)} className="btn-secondary">
                  Abrir constructor
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
