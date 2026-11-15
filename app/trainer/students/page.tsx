"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { activityLabels } from "@/lib/activity-date";
import { apiAction } from "@/lib/api-client";
import { StudentAccessControl } from "@/components/student-access-control";

interface Student {
  id: string;
  nombre: string;
  email: string | null;
  activo: boolean;
}

interface StudentOverview {
  id: string;
  nombre: string;
  email: string | null;
  activeRoutine: { id: string; meso: number; total_mc: number } | null;
  currentMicrocycle: number | null;
  progress: { completedSeries: number; expectedSeries: number; percentage: number };
  lastActivity: string | null;
  noteCount: number;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [overviews, setOverviews] = useState<Record<string, StudentOverview>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ nombre: "", email: "" });
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void fetchStudents();
  }, []);

  async function fetchStudents() {
    setLoading(true);
    try {
      setErrorMessage("");
      const [studentRows, overviewRows] = await Promise.all([
        apiAction<Student[]>("students.list"),
        apiAction<StudentOverview[]>("students.overview"),
      ]);
      setStudents(studentRows);
      setOverviews(Object.fromEntries(overviewRows.map((overview) => [overview.id, overview])));
    } catch (error) {
      console.error("Error fetching alumnos:", error);
      setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar los alumnos.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddStudent(event: React.FormEvent) {
    event.preventDefault();
    if (!formData.nombre.trim()) return;
    try {
      setErrorMessage("");
      await apiAction<Student>("students.create", formData);
      setFormData({ nombre: "", email: "" });
      setShowForm(false);
      await fetchStudents();
    } catch (error) {
      console.error("Error adding alumno:", error);
      setErrorMessage(error instanceof Error ? error.message : "Error al agregar alumno.");
    }
  }

  async function toggleActive(id: string, active: boolean) {
    try {
      setErrorMessage("");
      await apiAction<Student>("students.toggle", { id, activo: active });
      await fetchStudents();
    } catch (error) {
      console.error("Error updating alumno:", error);
      setErrorMessage(error instanceof Error ? error.message : "No se pudo actualizar el alumno.");
    }
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Alumnos</h1>
          <p className="mt-1 text-sm text-gray-400">Seguimiento de cargas y notas</p>
        </div>
        <button type="button" onClick={() => setShowForm(!showForm)} className="btn-primary">
          + Agregar alumno
        </button>
      </div>

      {errorMessage && <p className="card mb-6 p-4 text-sm text-gray-300">{errorMessage}</p>}

      {showForm && (
        <form onSubmit={handleAddStudent} className="card mb-7 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Nombre"
              value={formData.nombre}
              onChange={(event) => setFormData({ ...formData, nombre: event.target.value })}
              required
            />
            <input
              type="email"
              placeholder="Email (opcional)"
              value={formData.email}
              onChange={(event) => setFormData({ ...formData, email: event.target.value })}
            />
          </div>
          <p className="mt-3 text-sm text-gray-400">
            Dejalo vacío si el alumno no tiene correo; después generás su QR.
          </p>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">Guardar</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-12 text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-vakhan-red" />
        </div>
      ) : (
        <div className="grid gap-4">
          {students.map((student) => {
            const overview = overviews[student.id];
            const activity = activityLabels(overview?.lastActivity ?? null);
            return (
              <article key={student.id} className="card p-4 sm:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-white">{student.nombre}</h2>
                      <span className="rounded-input border border-vakhan-light-gray px-2 py-1 text-xs text-gray-400">
                        {student.activo ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-sm text-gray-400">
                      {student.email || "Sin correo · acceso mediante QR"}
                    </p>
                  </div>

                  {student.activo && overview ? (
                    <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:max-w-3xl xl:grid-cols-4">
                      <div className="rounded-input border border-vakhan-light-gray bg-vakhan-black p-3">
                        <p className="eyebrow">Rutina activa</p>
                        <p className="mt-2 text-sm font-medium text-gray-200">
                          {overview.activeRoutine
                            ? `Meso ${overview.activeRoutine.meso} · MC ${overview.currentMicrocycle}/${overview.activeRoutine.total_mc}`
                            : "Sin rutina activa"}
                        </p>
                      </div>
                      <div className="rounded-input border border-vakhan-light-gray bg-vakhan-black p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="eyebrow">Avance del MC</p>
                          <span className="text-sm font-semibold tabular-nums text-gray-200">
                            {overview.progress.percentage}%
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-vakhan-light-gray">
                          <div
                            className="h-full bg-gray-300"
                            style={{ width: `${overview.progress.percentage}%` }}
                          />
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          {overview.progress.completedSeries}/{overview.progress.expectedSeries} series
                        </p>
                      </div>
                      <div className="rounded-input border border-vakhan-light-gray bg-vakhan-black p-3">
                        <p className="eyebrow">Última actividad</p>
                        <p className="mt-2 text-sm font-medium text-gray-200">{activity.relative}</p>
                        <p className="mt-1 text-xs text-gray-500">{activity.absolute}</p>
                      </div>
                      <div className="rounded-input border border-vakhan-light-gray bg-vakhan-black p-3">
                        <p className="eyebrow">Notas del alumno</p>
                        <p className="mt-2 text-sm font-medium text-gray-200">
                          {overview.noteCount} {overview.noteCount === 1 ? "nota" : "notas"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="flex-1 text-sm text-gray-500">El alumno está inactivo.</p>
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-2 border-t border-vakhan-light-gray pt-4 sm:flex-row sm:justify-end">
                  {student.activo && <StudentAccessControl alumnoId={student.id} />}
                  {student.activo && (
                    <Link href={`/trainer/students/${student.id}`} className="btn-secondary">
                      Ver cargas
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => void toggleActive(student.id, student.activo)}
                    className="btn-secondary"
                  >
                    {student.activo ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </article>
            );
          })}
          {students.length === 0 && (
            <p className="card p-8 text-center text-sm text-gray-400">Todavía no hay alumnos.</p>
          )}
        </div>
      )}
    </div>
  );
}
