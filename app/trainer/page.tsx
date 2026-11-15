"use client";

import { useEffect, useState } from "react";
import { apiAction } from "@/lib/api-client";

export default function TrainerPage() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    activePrograms: 0,
    totalExercises: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        setStats(await apiAction<typeof stats>("stats"));
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <div>
      <h1 className="mb-7 text-3xl font-semibold text-white">
        Bienvenido al Panel
      </h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-5">
          <h3 className="eyebrow mb-3">
            ALUMNOS TOTALES
          </h3>
          <p className="text-3xl font-semibold tabular-nums text-white">
            {loading ? "-" : stats.totalStudents}
          </p>
        </div>

        <div className="card p-5">
          <h3 className="eyebrow mb-3">
            RUTINAS ACTIVAS
          </h3>
          <p className="text-3xl font-semibold tabular-nums text-white">
            {loading ? "-" : stats.activePrograms}
          </p>
        </div>

        <div className="card p-5">
          <h3 className="eyebrow mb-3">
            EJERCICIOS EN BIBLIOTECA
          </h3>
          <p className="text-3xl font-semibold tabular-nums text-white">
            {loading ? "-" : stats.totalExercises}
          </p>
        </div>
      </div>
    </div>
  );
}
