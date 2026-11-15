"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { studentAction } from "@/lib/api-client";

interface ExerciseOption {
  id: string;
  nombre: string;
  categoria: string;
  assignmentIds: string[];
}

interface LoadDetail {
  id: string;
  mc: number;
  serie: number;
  peso: number | null;
  reps: number | null;
  rir: number | null;
}

interface ChartPoint {
  mc: number;
  peso: number | null;
  reps: number | null;
}

function average(values: number[]) {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export default function ProgressPage() {
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [details, setDetails] = useState<LoadDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function fetchRoutineExercises() {
      try {
        setErrorMessage("");
        const options = await studentAction<ExerciseOption[]>("progress.bootstrap");
        setExercises(options);
        setSelectedExerciseId(options[0]?.id ?? "");
      } catch (error) {
        console.error("Error al cargar ejercicios de progreso:", error);
        setErrorMessage(
          error instanceof Error ? error.message : "No se pudieron cargar los ejercicios.",
        );
      } finally {
        setLoading(false);
      }
    }

    void fetchRoutineExercises();
  }, []);

  useEffect(() => {
    async function fetchProgress() {
      if (!selectedExerciseId) {
        setDetails([]);
        return;
      }

      setLoadingData(true);
      try {
        setErrorMessage("");
        const rows = await studentAction<LoadDetail[]>("progress.details", {
          exerciseId: selectedExerciseId,
        });
        setDetails(rows);
      } catch (error) {
        console.error("Error al cargar el progreso:", error);
        setDetails([]);
        setErrorMessage(
          error instanceof Error ? error.message : "No se pudo cargar el progreso.",
        );
      } finally {
        setLoadingData(false);
      }
    }

    void fetchProgress();
  }, [selectedExerciseId]);

  const chartData = useMemo<ChartPoint[]>(() => {
    const byMicrocycle = new Map<number, { weights: number[]; repetitions: number[] }>();

    for (const row of details) {
      const group = byMicrocycle.get(row.mc) ?? { weights: [], repetitions: [] };
      if (row.peso !== null) group.weights.push(Number(row.peso));
      if (row.reps !== null) group.repetitions.push(Number(row.reps));
      byMicrocycle.set(row.mc, group);
    }

    return Array.from(byMicrocycle.entries())
      .sort(([first], [second]) => first - second)
      .map(([mc, values]) => ({
        mc,
        peso: average(values.weights),
        reps: average(values.repetitions),
      }));
  }, [details]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow">Historial</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Mi progreso</h1>
      </header>

      {errorMessage && (
        <p className="card mb-5 p-4 text-sm text-gray-300">
          {errorMessage}
        </p>
      )}

      {loading ? (
        <div className="py-16 text-center text-gray-400">Cargando progreso...</div>
      ) : errorMessage && exercises.length === 0 ? null : exercises.length === 0 ? (
        <div className="card border-dashed p-10 text-center text-gray-400">
          Tu rutina activa todavía no tiene ejercicios.
        </div>
      ) : (
        <div className="space-y-5">
          <label className="eyebrow block text-gray-300">
            Ejercicio
            <select
              value={selectedExerciseId}
              onChange={(event) => setSelectedExerciseId(event.target.value)}
              className="input mt-2 w-full text-sm normal-case tracking-normal"
            >
              {exercises.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.nombre} · {exercise.categoria}
                </option>
              ))}
            </select>
          </label>

          {loadingData ? (
            <div className="py-16 text-center text-gray-400">Cargando datos...</div>
          ) : chartData.length === 0 ? (
            <div className="card p-10 text-center text-gray-400">
              Aún no hay cargas registradas para este ejercicio.
            </div>
          ) : (
            <>
              <section className="card p-3 sm:p-5">
                <div className="mb-4">
                  <h2 className="font-semibold text-white">Evolución por microciclo</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Promedio de las series registradas en cada MC.
                  </p>
                </div>
                <div className="h-72 w-full sm:h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 4, left: -24, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3C" />
                      <XAxis dataKey="mc" stroke="#9CA3AF" tickLine={false} />
                      <YAxis yAxisId="weight" stroke="#CC1E1E" tickLine={false} />
                      <YAxis
                        yAxisId="reps"
                        orientation="right"
                        stroke="#D1D5DB"
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1C1C1E",
                          border: "1px solid #3A3A3C",
                          borderRadius: 6,
                        }}
                        labelFormatter={(mc) => `Microciclo ${mc}`}
                      />
                      <Legend />
                      <Line
                        yAxisId="weight"
                        type="monotone"
                        dataKey="peso"
                        stroke="#CC1E1E"
                        strokeWidth={3}
                        dot={{ fill: "#CC1E1E", r: 4 }}
                        name="Peso promedio (kg)"
                      />
                      <Line
                        yAxisId="reps"
                        type="monotone"
                        dataKey="reps"
                        stroke="#D1D5DB"
                        strokeWidth={2}
                        dot={{ fill: "#D1D5DB", r: 4 }}
                        name="Reps promedio"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="card overflow-hidden">
                <div className="border-b border-vakhan-light-gray p-4 sm:p-5">
                  <h2 className="font-semibold text-white">Detalle de cargas</h2>
                  <p className="mt-1 text-xs text-gray-500">Una fila por serie registrada.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-vakhan-black text-xs uppercase tracking-label text-gray-500">
                      <tr>
                        <th className="px-4 py-3">MC</th>
                        <th className="px-4 py-3">Serie</th>
                        <th className="px-4 py-3">Peso</th>
                        <th className="px-4 py-3">Reps</th>
                        <th className="px-4 py-3">RIR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.map((row) => (
                        <tr key={row.id} className="border-t border-vakhan-light-gray">
                          <td className="px-4 py-3 font-semibold tabular-nums text-white">{row.mc}</td>
                          <td className="px-4 py-3 tabular-nums">{row.serie}</td>
                          <td className="px-4 py-3 tabular-nums">
                            {row.peso === null ? "—" : `${row.peso} kg`}
                          </td>
                          <td className="px-4 py-3 tabular-nums">{row.reps ?? "—"}</td>
                          <td className="px-4 py-3 tabular-nums">{row.rir ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
