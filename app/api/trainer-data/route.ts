import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

import { ApiError } from "@/lib/api-error";
import { getTrainerEmails } from "@/lib/auth-roles";
import { throwDatabaseError } from "@/lib/database-errors";
import { createActiveRoutineWithRollback } from "@/lib/routine-activation";
import {
  getStudentOverviews,
  type StudentOverviewRepository,
} from "@/lib/student-overview";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  type ProgramRemovalRepository,
  removeBlockWithHistoryProtection,
  removeExerciseWithHistoryProtection,
  saveTeacherNote as persistTeacherNote,
} from "@/lib/trainer-program-actions";
import { getTrainerStats, type TrainerStatsRepository } from "@/lib/trainer-stats";
import { saveTrainerLoad, type TrainerLoadContextRepository } from "@/lib/trainer-load-actions";
import type { StudentLoadRepository } from "@/lib/student-load-actions";
import {
  createStudentAccess,
  getStudentAccessStatus,
  normalizeOptionalStudentEmail,
  revokeStudentAccess,
  type TrainerStudentAccessRepository,
} from "@/lib/trainer-student-access-actions";

export const dynamic = "force-dynamic";

const TRAINER_EMAILS = getTrainerEmails();

type Payload = Record<string, unknown>;

function requireString(payload: Payload, key: string) {
  const value = payload[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(`El campo ${key} es obligatorio.`);
  }
  return value.trim();
}

function requireNumber(payload: Payload, key: string, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const value = Number(payload[key]);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ApiError(`El campo ${key} no es válido.`);
  }
  return value;
}

function requireNumeric(payload: Payload, key: string) {
  const value = Number(payload[key]);
  if (!Number.isFinite(value)) throw new ApiError(`El campo ${key} no es válido.`);
  return value;
}

async function requireTrainer(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const email = typeof token?.email === "string" ? token.email.toLowerCase() : "";

  if (!email) throw new ApiError("Tu sesión venció. Volvé a iniciar sesión.", 401);
  if (!TRAINER_EMAILS.includes(email)) {
    throw new ApiError("No tenés permisos de entrenador.", 403);
  }
  return email;
}

async function stats() {
  const repository: TrainerStatsRepository = {
    async countStudents() {
      const result = await supabaseAdmin
        .from("alumnos")
        .select("id", { count: "exact", head: true });
      throwDatabaseError(result.error, "No se pudieron contar los alumnos");
      return result.count ?? 0;
    },
    async countActivePrograms() {
      const result = await supabaseAdmin
        .from("rutinas")
        .select("id", { count: "exact", head: true })
        .eq("activa", true);
      throwDatabaseError(result.error, "No se pudieron contar las rutinas activas");
      return result.count ?? 0;
    },
    async countExercises() {
      const result = await supabaseAdmin
        .from("ejercicios")
        .select("id", { count: "exact", head: true });
      throwDatabaseError(result.error, "No se pudieron contar los ejercicios");
      return result.count ?? 0;
    },
  };

  return getTrainerStats(repository);
}

async function listStudents() {
  const { data, error } = await supabaseAdmin
    .from("alumnos")
    .select("id,nombre,email,activo")
    .order("nombre");
  throwDatabaseError(error, "No se pudieron cargar los alumnos");
  return data ?? [];
}

async function studentsOverview() {
  const repository: StudentOverviewRepository = {
    async listActiveStudents() {
      const { data, error } = await supabaseAdmin
        .from("alumnos")
        .select("id,nombre,email,activo")
        .eq("activo", true)
        .order("nombre");
      throwDatabaseError(error, "No se pudieron cargar los alumnos activos");
      return data ?? [];
    },
    async listRoutines(studentIds) {
      if (!studentIds.length) return [];
      const { data, error } = await supabaseAdmin
        .from("rutinas")
        .select("id,alumno_id,meso,total_mc,activa,created_at")
        .in("alumno_id", studentIds);
      throwDatabaseError(error, "No se pudieron cargar las rutinas activas");
      return data ?? [];
    },
    async listAssignments(routineIds) {
      if (!routineIds.length) return [];
      const { data: days, error: daysError } = await supabaseAdmin
        .from("dias")
        .select("id,rutina_id")
        .in("rutina_id", routineIds);
      throwDatabaseError(daysError, "No se pudieron cargar los días de las rutinas");
      const routineByDay = new Map((days ?? []).map((day) => [day.id, day.rutina_id]));
      if (!routineByDay.size) return [];

      const { data: blocks, error: blocksError } = await supabaseAdmin
        .from("bloques")
        .select("id,dia_id")
        .in("dia_id", [...routineByDay.keys()]);
      throwDatabaseError(blocksError, "No se pudieron cargar los bloques de las rutinas");
      const routineByBlock = new Map(
        (blocks ?? []).flatMap((block) => {
          const routineId = routineByDay.get(block.dia_id);
          return routineId ? [[block.id, routineId] as const] : [];
        }),
      );
      if (!routineByBlock.size) return [];

      const { data, error } = await supabaseAdmin
        .from("ejercicios_bloque")
        .select("id,bloque_id,dosis")
        .in("bloque_id", [...routineByBlock.keys()]);
      throwDatabaseError(error, "No se pudieron cargar los ejercicios asignados");
      return (data ?? []).flatMap((assignment) => {
        const routineId = routineByBlock.get(assignment.bloque_id);
        return routineId
          ? [{
              id: assignment.id,
              rutina_id: routineId,
              dosis: (assignment.dosis ?? {}) as Record<string, unknown>,
            }]
          : [];
      });
    },
    async listLoads(assignmentIds) {
      if (!assignmentIds.length) return [];
      const { data, error } = await supabaseAdmin
        .from("cargas")
        .select("alumno_id,ejercicio_bloque_id,mc,serie,updated_at")
        .in("ejercicio_bloque_id", assignmentIds);
      throwDatabaseError(error, "No se pudieron cargar las actividades de los alumnos");
      return data ?? [];
    },
    async listNotes(assignmentIds) {
      if (!assignmentIds.length) return [];
      const { data, error } = await supabaseAdmin
        .from("notas_ejercicio")
        .select("alumno_id,ejercicio_bloque_id,mc")
        .in("ejercicio_bloque_id", assignmentIds);
      throwDatabaseError(error, "No se pudieron cargar las notas de los alumnos");
      return data ?? [];
    },
  };

  return getStudentOverviews(repository);
}

async function studentDetail(payload: Payload) {
  const alumnoId = requireString(payload, "alumnoId");
  const requestedRoutineId =
    typeof payload.rutinaId === "string" && payload.rutinaId.trim()
      ? payload.rutinaId.trim()
      : null;

  const { data: student, error: studentError } = await supabaseAdmin
    .from("alumnos")
    .select("id,nombre,email,activo")
    .eq("id", alumnoId)
    .single();
  throwDatabaseError(studentError, "No se encontró el alumno");

  const { data: routines, error: routinesError } = await supabaseAdmin
    .from("rutinas")
    .select("id,alumno_id,meso,total_mc,activa,created_at")
    .eq("alumno_id", alumnoId)
    .order("created_at", { ascending: false });
  throwDatabaseError(routinesError, "No se pudieron cargar las rutinas del alumno");

  const allRoutines = routines ?? [];
  const selectedRoutine = requestedRoutineId
    ? allRoutines.find((routine) => routine.id === requestedRoutineId)
    : allRoutines.find((routine) => routine.activa) ?? allRoutines[0];

  if (requestedRoutineId && !selectedRoutine) {
    throw new ApiError("La rutina seleccionada no pertenece al alumno.", 404);
  }
  if (!selectedRoutine) return { student, routines: allRoutines, selectedRoutine: null, days: [] };

  const { data: daysData, error: daysError } = await supabaseAdmin
    .from("dias")
    .select("id,numero,titulo")
    .eq("rutina_id", selectedRoutine.id)
    .order("numero");
  throwDatabaseError(daysError, "No se pudieron cargar los días de la rutina");
  const days = daysData ?? [];
  const dayIds = days.map((day) => day.id);

  const { data: blocksData, error: blocksError } = dayIds.length
    ? await supabaseAdmin
        .from("bloques")
        .select("id,dia_id,numero,titulo")
        .in("dia_id", dayIds)
        .order("numero")
    : { data: [], error: null };
  throwDatabaseError(blocksError, "No se pudieron cargar los bloques de la rutina");
  const blocks = blocksData ?? [];
  const blockIds = blocks.map((block) => block.id);

  const { data: assignmentsData, error: assignmentsError } = blockIds.length
    ? await supabaseAdmin
        .from("ejercicios_bloque")
        .select("id,bloque_id,ejercicio_id,dosis,nota_profesor")
        .in("bloque_id", blockIds)
        .order("created_at")
    : { data: [], error: null };
  throwDatabaseError(assignmentsError, "No se pudieron cargar los ejercicios de la rutina");
  const assignments = assignmentsData ?? [];
  const assignmentIds = assignments.map((assignment) => assignment.id);
  const exerciseIds = [...new Set(assignments.map((assignment) => assignment.ejercicio_id))];

  const [exercisesResult, loadsResult, notesResult] = await Promise.all([
    exerciseIds.length
      ? supabaseAdmin
          .from("ejercicios")
          .select("id,nombre,categoria,url_video")
          .in("id", exerciseIds)
      : Promise.resolve({ data: [], error: null }),
    assignmentIds.length
      ? supabaseAdmin
          .from("cargas")
          .select("ejercicio_bloque_id,mc,serie,reps,peso,rir,updated_at,updated_by")
          .eq("alumno_id", alumnoId)
          .in("ejercicio_bloque_id", assignmentIds)
          .order("mc")
          .order("serie")
      : Promise.resolve({ data: [], error: null }),
    assignmentIds.length
      ? supabaseAdmin
          .from("notas_ejercicio")
          .select("ejercicio_bloque_id,mc,nota,updated_at")
          .eq("alumno_id", alumnoId)
          .in("ejercicio_bloque_id", assignmentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  throwDatabaseError(exercisesResult.error, "No se pudieron cargar los ejercicios");
  throwDatabaseError(loadsResult.error, "No se pudieron cargar las cargas del alumno");
  throwDatabaseError(notesResult.error, "No se pudieron cargar las notas del alumno");

  const exerciseById = new Map(
    (exercisesResult.data ?? []).map((exercise) => [exercise.id, exercise]),
  );
  const loads = loadsResult.data ?? [];
  const notes = notesResult.data ?? [];

  return {
    student,
    routines: allRoutines,
    selectedRoutine,
    days: days.map((day) => ({
      ...day,
      bloques: blocks
        .filter((block) => block.dia_id === day.id)
        .map((block) => ({
          id: block.id,
          numero: block.numero,
          titulo: block.titulo,
          ejercicios: assignments.flatMap((assignment) => {
            if (assignment.bloque_id !== block.id) return [];
            const exercise = exerciseById.get(assignment.ejercicio_id);
            if (!exercise) return [];
            const assignmentLoads = loads.filter(
              (load) => load.ejercicio_bloque_id === assignment.id,
            );
            const assignmentNotes = notes.filter(
              (note) => note.ejercicio_bloque_id === assignment.id,
            );
            return [{
              id: assignment.id,
              ejercicio: exercise,
              dosis: assignment.dosis ?? {},
              nota_profesor: assignment.nota_profesor ?? null,
              cargas_por_mc: assignmentLoads.reduce<Record<string, typeof assignmentLoads>>(
                (byMicrocycle, load) => {
                  const key = String(load.mc);
                  byMicrocycle[key] = [...(byMicrocycle[key] ?? []), load];
                  return byMicrocycle;
                },
                {},
              ),
              notas_por_mc: Object.fromEntries(
                assignmentNotes.map((note) => [String(note.mc), note.nota]),
              ),
            }];
          }),
        })),
    })),
  };
}

async function createStudent(payload: Payload) {
  const nombre = requireString(payload, "nombre");
  const email = normalizeOptionalStudentEmail(payload.email);

  const { data, error } = await supabaseAdmin
    .from("alumnos")
    .insert({ nombre, email, activo: true })
    .select("id,nombre,email,activo")
    .single();
  throwDatabaseError(error, "No se pudo agregar el alumno");
  return data;
}

const trainerStudentAccessRepository: TrainerStudentAccessRepository = {
  async revokeActive(alumnoId, revokedAt) {
    const { error } = await supabaseAdmin
      .from("alumno_accesos")
      .update({ revoked_at: revokedAt })
      .eq("alumno_id", alumnoId)
      .is("revoked_at", null);
    throwDatabaseError(error, "No se pudo anular el acceso anterior");
  },
  async create(input) {
    const { error } = await supabaseAdmin.from("alumno_accesos").insert({
      alumno_id: input.alumnoId,
      token_hash: input.tokenHash,
      created_at: input.createdAt,
      expires_at: input.expiresAt,
    });
    throwDatabaseError(error, "No se pudo crear el acceso");
  },
  async findCurrent(alumnoId) {
    const { data, error } = await supabaseAdmin
      .from("alumno_accesos")
      .select("id,created_at,expires_at,last_used_at")
      .eq("alumno_id", alumnoId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    throwDatabaseError(error, "No se pudo consultar el acceso");
    if (!data) return null;
    return {
      id: data.id,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
      lastUsedAt: data.last_used_at,
    };
  },
};

async function createAccessAction(payload: Payload) {
  const alumnoId = requireString(payload, "alumnoId");
  const origin = process.env.NEXTAUTH_URL;
  if (!origin) throw new ApiError("Falta configurar NEXTAUTH_URL.", 500);
  return createStudentAccess(trainerStudentAccessRepository, alumnoId, origin);
}

async function revokeAccessAction(payload: Payload) {
  return revokeStudentAccess(
    trainerStudentAccessRepository,
    requireString(payload, "alumnoId"),
  );
}

async function accessStatusAction(payload: Payload) {
  return getStudentAccessStatus(
    trainerStudentAccessRepository,
    requireString(payload, "alumnoId"),
  );
}

const trainerLoadContextRepository: TrainerLoadContextRepository = {
  async findAssignmentOwner(assignmentId) {
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("ejercicios_bloque")
      .select("bloque_id")
      .eq("id", assignmentId)
      .maybeSingle();
    throwDatabaseError(assignmentError, "No se pudo verificar el ejercicio asignado");
    if (!assignment) return null;

    const { data: block, error: blockError } = await supabaseAdmin
      .from("bloques")
      .select("dia_id")
      .eq("id", assignment.bloque_id)
      .maybeSingle();
    throwDatabaseError(blockError, "No se pudo verificar el bloque");
    if (!block) return null;

    const { data: day, error: dayError } = await supabaseAdmin
      .from("dias")
      .select("rutina_id")
      .eq("id", block.dia_id)
      .maybeSingle();
    throwDatabaseError(dayError, "No se pudo verificar el día");
    if (!day) return null;

    const { data: routine, error: routineError } = await supabaseAdmin
      .from("rutinas")
      .select("alumno_id,total_mc")
      .eq("id", day.rutina_id)
      .maybeSingle();
    throwDatabaseError(routineError, "No se pudo verificar la rutina");
    if (!routine) return null;
    return { alumnoId: routine.alumno_id, totalMicrocycles: routine.total_mc };
  },
};

const trainerLoadRepository: StudentLoadRepository = {
  async findLoad(studentId, input) {
    const { data, error } = await supabaseAdmin
      .from("cargas")
      .select("id")
      .eq("alumno_id", studentId)
      .eq("ejercicio_bloque_id", input.assignmentId)
      .eq("mc", input.mc)
      .eq("serie", input.serie)
      .maybeSingle();
    throwDatabaseError(error, "No se pudo verificar la carga");
    return data;
  },
  async updateLoad(loadId, studentId, input, audit) {
    const { data, error } = await supabaseAdmin
      .from("cargas")
      .update({
        reps: input.reps,
        peso: input.peso,
        rir: input.rir,
        updated_at: new Date().toISOString(),
        updated_by: audit.updatedBy,
      })
      .eq("id", loadId)
      .eq("alumno_id", studentId)
      .select("id")
      .single();
    throwDatabaseError(error, "No se pudo actualizar la carga");
    if (!data) throw new ApiError("No se pudo actualizar la carga.", 500);
    return data;
  },
  async insertLoad(studentId, input, audit) {
    const { data, error } = await supabaseAdmin
      .from("cargas")
      .insert({
        alumno_id: studentId,
        ejercicio_bloque_id: input.assignmentId,
        mc: input.mc,
        serie: input.serie,
        reps: input.reps,
        peso: input.peso,
        rir: input.rir,
        updated_at: new Date().toISOString(),
        updated_by: audit.updatedBy,
      })
      .select("id")
      .single();
    if (error?.code === "23505") throw error;
    throwDatabaseError(error, "No se pudo guardar la carga");
    if (!data) throw new ApiError("No se pudo guardar la carga.", 500);
    return data;
  },
};

async function saveTrainerLoadAction(payload: Payload, trainerEmail: string) {
  return saveTrainerLoad(trainerLoadContextRepository, trainerLoadRepository, trainerEmail, {
    alumnoId: requireString(payload, "alumnoId"),
    assignmentId: requireString(payload, "assignmentId"),
    mc: requireNumber(payload, "mc", 1, 52),
    serie: requireNumber(payload, "serie", 1, 20),
    reps: requireNumeric(payload, "reps"),
    peso: requireNumeric(payload, "peso"),
    rir: requireNumeric(payload, "rir"),
  });
}

async function toggleStudent(payload: Payload) {
  const id = requireString(payload, "id");
  if (typeof payload.activo !== "boolean") throw new ApiError("El estado no es válido.");

  const { data, error } = await supabaseAdmin
    .from("alumnos")
    .update({ activo: !payload.activo })
    .eq("id", id)
    .select("id,nombre,email,activo")
    .single();
  throwDatabaseError(error, "No se pudo actualizar el alumno");
  return data;
}

async function listExercises() {
  const { data, error } = await supabaseAdmin
    .from("ejercicios")
    .select("id,nombre,categoria,url_video")
    .order("categoria")
    .order("nombre");
  throwDatabaseError(error, "No se pudieron cargar los ejercicios");
  return data ?? [];
}

async function createExercise(payload: Payload) {
  const nombre = requireString(payload, "nombre");
  const categoria = requireString(payload, "categoria");
  const rawUrl = payload.urlVideo;
  if (rawUrl !== undefined && typeof rawUrl !== "string") {
    throw new ApiError("La URL del video no es válida.");
  }

  const urlVideo = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (urlVideo) {
    try {
      const url = new URL(urlVideo);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error("invalid protocol");
    } catch {
      throw new ApiError("Ingresá una URL de video válida que comience con http:// o https://.");
    }
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("ejercicios")
    .select("id")
    .ilike("nombre", nombre)
    .ilike("categoria", categoria)
    .limit(1);
  throwDatabaseError(existingError, "No se pudo verificar el ejercicio");
  if (existing?.length) {
    throw new ApiError("Ese ejercicio ya existe dentro de la categoría seleccionada.", 409);
  }

  const { data, error } = await supabaseAdmin
    .from("ejercicios")
    .insert({ nombre, categoria, url_video: urlVideo || null })
    .select("id,nombre,categoria,url_video")
    .single();
  throwDatabaseError(
    error,
    "No se pudo crear el ejercicio",
    "Ese ejercicio ya existe dentro de la categor\u00eda seleccionada.",
  );
  return data;
}

async function programsBootstrap() {
  const [studentsResult, routinesResult, exercisesResult] = await Promise.all([
    supabaseAdmin.from("alumnos").select("id,nombre,email").order("nombre"),
    supabaseAdmin.from("rutinas").select("*").order("created_at", { ascending: false }),
    supabaseAdmin
      .from("ejercicios")
      .select("id,nombre,categoria,url_video")
      .order("nombre"),
  ]);

  throwDatabaseError(studentsResult.error, "No se pudieron cargar los alumnos");
  throwDatabaseError(routinesResult.error, "No se pudieron cargar las rutinas");
  throwDatabaseError(exercisesResult.error, "No se pudieron cargar los ejercicios");

  const students = studentsResult.data ?? [];
  const studentById = new Map(students.map((student) => [student.id, student]));
  const routines = (routinesResult.data ?? []).flatMap((routine) => {
    const alumno = studentById.get(routine.alumno_id);
    return alumno ? [{ ...routine, alumno }] : [];
  });

  return { students, routines, exercises: exercisesResult.data ?? [] };
}

async function createRoutine(payload: Payload) {
  const alumnoId = requireString(payload, "alumnoId");
  const meso = requireNumber(payload, "meso");
  const totalMc = requireNumber(payload, "totalMc", 1, 52);
  const diasSemana = requireNumber(payload, "diasSemana", 1, 7);

  const { data: alumno, error: studentError } = await supabaseAdmin
    .from("alumnos")
    .select("id,nombre,email")
    .eq("id", alumnoId)
    .single();
  throwDatabaseError(studentError, "No se encontró el alumno");

  const routine = await createActiveRoutineWithRollback(
    {
      async findActiveRoutineIds(studentId) {
        const { data, error } = await supabaseAdmin
          .from("rutinas")
          .select("id")
          .eq("alumno_id", studentId)
          .eq("activa", true);
        throwDatabaseError(error, "No se pudo verificar la rutina activa");
        return (data ?? []).map((item) => item.id);
      },
      async setRoutinesActive(routineIds, active) {
        const { error } = await supabaseAdmin
          .from("rutinas")
          .update({ activa: active })
          .in("id", routineIds);
        throwDatabaseError(error, "No se pudo actualizar la rutina activa");
      },
      async insertActiveRoutine(input) {
        const { data, error } = await supabaseAdmin
          .from("rutinas")
          .insert({
            alumno_id: input.alumnoId,
            meso: input.meso,
            total_mc: input.totalMc,
            dias_semana: input.diasSemana,
            activa: true,
          })
          .select()
          .single();
        throwDatabaseError(error, "No se pudo crear la rutina");
        if (!data) throw new ApiError("No se pudo crear la rutina.", 500);
        return data;
      },
      async createInitialStructure(routineId, daysPerWeek) {
        const { data: days, error: daysError } = await supabaseAdmin
          .from("dias")
          .insert(
            Array.from({ length: daysPerWeek }, (_, index) => ({
              rutina_id: routineId,
              numero: index + 1,
              titulo: `Día ${index + 1}`,
            })),
          )
          .select("id");
        throwDatabaseError(daysError, "No se pudieron crear los días");

        const { error: blocksError } = await supabaseAdmin
          .from("bloques")
          .insert(
            (days ?? []).map((day) => ({
              dia_id: day.id,
              numero: 1,
              titulo: "Entrada en calor",
            })),
          );
        throwDatabaseError(blocksError, "No se pudieron crear los bloques iniciales");
      },
      async deleteRoutine(routineId) {
        const { error } = await supabaseAdmin.from("rutinas").delete().eq("id", routineId);
        throwDatabaseError(error, "No se pudo revertir la rutina incompleta");
      },
    },
    { alumnoId, meso, totalMc, diasSemana },
  );

  return { ...routine, alumno };
}

async function openRoutine(payload: Payload) {
  const routineId = requireString(payload, "routineId");

  const { data: routine, error: routineError } = await supabaseAdmin
    .from("rutinas")
    .select("id,dias_semana,total_mc")
    .eq("id", routineId)
    .single();
  throwDatabaseError(routineError, "No se encontró la rutina");
  if (!routine) throw new ApiError("No se encontró la rutina.", 404);

  const { data: storedDays, error: daysError } = await supabaseAdmin
    .from("dias")
    .select("id,numero,titulo")
    .eq("rutina_id", routineId)
    .order("numero");
  throwDatabaseError(daysError, "No se pudieron cargar los días");

  let days = storedDays ?? [];
  const dayNumbers = new Set(days.map((day) => day.numero));
  const missingNumbers = Array.from(
    { length: routine.dias_semana },
    (_, index) => index + 1,
  ).filter((numero) => !dayNumbers.has(numero));

  if (missingNumbers.length) {
    const { data: createdDays, error } = await supabaseAdmin
      .from("dias")
      .insert(
        missingNumbers.map((numero) => ({
          rutina_id: routineId,
          numero,
          titulo: `Día ${numero}`,
        })),
      )
      .select("id,numero,titulo");
    throwDatabaseError(error, "No se pudieron completar los días");
    days = [...days, ...(createdDays ?? [])].sort((a, b) => a.numero - b.numero);
  }

  const dayIds = days.map((day) => day.id);
  let blocks: Array<{ id: string; dia_id: string; numero: number; titulo: string }> = [];
  if (dayIds.length) {
    const { data, error } = await supabaseAdmin
      .from("bloques")
      .select("id,dia_id,numero,titulo")
      .in("dia_id", dayIds)
      .order("numero");
    throwDatabaseError(error, "No se pudieron cargar los bloques");
    blocks = data ?? [];

    const daysWithoutBlocks = dayIds.filter(
      (dayId) => !blocks.some((block) => block.dia_id === dayId),
    );
    if (daysWithoutBlocks.length) {
      const { data: createdBlocks, error: createError } = await supabaseAdmin
        .from("bloques")
        .insert(
          daysWithoutBlocks.map((dia_id) => ({
            dia_id,
            numero: 1,
            titulo: "Entrada en calor",
          })),
        )
        .select("id,dia_id,numero,titulo");
      throwDatabaseError(createError, "No se pudieron completar los bloques");
      blocks = [...blocks, ...(createdBlocks ?? [])];
    }
  }

  const blockIds = blocks.map((block) => block.id);
  let assignments: Array<{
    id: string;
    bloque_id: string;
    ejercicio_id: string;
    dosis: Record<string, unknown>;
    nota_profesor: string | null;
  }> = [];
  if (blockIds.length) {
    const { data, error } = await supabaseAdmin
      .from("ejercicios_bloque")
      .select("id,bloque_id,ejercicio_id,dosis,nota_profesor")
      .in("bloque_id", blockIds)
      .order("created_at");
    throwDatabaseError(error, "No se pudieron cargar los ejercicios asignados");
    assignments = (data ?? []) as typeof assignments;
  }

  const exerciseIds = [...new Set(assignments.map((item) => item.ejercicio_id))];
  let exerciseById = new Map<string, Record<string, unknown>>();
  if (exerciseIds.length) {
    const { data, error } = await supabaseAdmin
      .from("ejercicios")
      .select("id,nombre,categoria,url_video")
      .in("id", exerciseIds);
    throwDatabaseError(error, "No se pudieron cargar los datos de los ejercicios");
    exerciseById = new Map((data ?? []).map((exercise) => [exercise.id, exercise]));
  }

  return days.map((day) => ({
    ...day,
    bloques: blocks
      .filter((block) => block.dia_id === day.id)
      .sort((a, b) => a.numero - b.numero)
      .map((block) => ({
        id: block.id,
        numero: block.numero,
        titulo: block.titulo,
        ejercicios: assignments.flatMap((assignment) => {
          if (assignment.bloque_id !== block.id) return [];
          const ejercicio = exerciseById.get(assignment.ejercicio_id);
          if (!ejercicio) return [];
          return [{
            id: assignment.id,
            ejercicio_id: assignment.ejercicio_id,
            ejercicio,
            dosis: Object.fromEntries(
              Object.entries(assignment.dosis ?? {}).map(([key, value]) => [key, String(value ?? "")]),
            ),
          }];
        }),
      })),
  }));
}

async function updateDayTitle(payload: Payload) {
  const dayId = requireString(payload, "dayId");
  const titulo = requireString(payload, "titulo");
  const { error } = await supabaseAdmin.from("dias").update({ titulo }).eq("id", dayId);
  throwDatabaseError(error, "No se pudo guardar el título del día");
  return { ok: true };
}

async function updateBlockTitle(payload: Payload) {
  const blockId = requireString(payload, "blockId");
  const titulo = requireString(payload, "titulo");
  const { error } = await supabaseAdmin
    .from("bloques")
    .update({ titulo })
    .eq("id", blockId);
  throwDatabaseError(error, "No se pudo guardar el nombre del bloque");
  return { ok: true };
}

async function addBlock(payload: Payload) {
  const dayId = requireString(payload, "dayId");
  const numero = requireNumber(payload, "numero", 1, 6);
  const titulo =
    typeof payload.titulo === "string" && payload.titulo.trim()
      ? payload.titulo.trim()
      : `Bloque ${numero}`;
  const { data, error } = await supabaseAdmin
    .from("bloques")
    .insert({ dia_id: dayId, numero, titulo })
    .select("id,numero,titulo")
    .single();
  throwDatabaseError(error, "No se pudo agregar el bloque");
  return { ...data, ejercicios: [] };
}

const programRemovalRepository: ProgramRemovalRepository = {
  async assignmentIdsForBlock(blockId) {
    const { data, error } = await supabaseAdmin
      .from("ejercicios_bloque")
      .select("id")
      .eq("bloque_id", blockId);
    throwDatabaseError(error, "No se pudieron verificar los ejercicios del bloque");
    return (data ?? []).map((assignment) => assignment.id);
  },
  async countLoadsForAssignments(assignmentIds) {
    if (!assignmentIds.length) return 0;
    const { count, error } = await supabaseAdmin
      .from("cargas")
      .select("id", { count: "exact", head: true })
      .in("ejercicio_bloque_id", assignmentIds);
    throwDatabaseError(error, "No se pudo verificar el historial de cargas");
    return count ?? 0;
  },
  async deleteBlock(blockId) {
    const { error } = await supabaseAdmin.from("bloques").delete().eq("id", blockId);
    throwDatabaseError(error, "No se pudo eliminar el bloque");
  },
  async deleteAssignment(assignmentId) {
    const { error } = await supabaseAdmin
      .from("ejercicios_bloque")
      .delete()
      .eq("id", assignmentId);
    throwDatabaseError(error, "No se pudo quitar el ejercicio");
  },
};

async function removeBlock(payload: Payload) {
  const blockId = requireString(payload, "blockId");
  await removeBlockWithHistoryProtection(programRemovalRepository, blockId);
  return { ok: true };
}

async function addExercise(payload: Payload) {
  const blockId = requireString(payload, "blockId");
  const exerciseId = requireString(payload, "exerciseId");
  const totalMc = requireNumber(payload, "totalMc", 1, 52);
  const dosis = Object.fromEntries(
    Array.from({ length: totalMc }, (_, index) => [String(index + 1), ""]),
  );

  const { data: assignment, error } = await supabaseAdmin
    .from("ejercicios_bloque")
    .insert({ bloque_id: blockId, ejercicio_id: exerciseId, dosis })
    .select("id,ejercicio_id,dosis,nota_profesor")
    .single();
  throwDatabaseError(error, "No se pudo agregar el ejercicio");

  const { data: ejercicio, error: exerciseError } = await supabaseAdmin
    .from("ejercicios")
    .select("id,nombre,categoria,url_video")
    .eq("id", exerciseId)
    .single();
  throwDatabaseError(exerciseError, "No se encontró el ejercicio");
  return { ...assignment, ejercicio, dosis };
}

async function removeExercise(payload: Payload) {
  const assignedId = requireString(payload, "assignedId");
  await removeExerciseWithHistoryProtection(programRemovalRepository, assignedId);
  return { ok: true };
}

async function saveDose(payload: Payload) {
  const assignedId = requireString(payload, "assignedId");
  const dosis = payload.dosis;
  if (!dosis || typeof dosis !== "object" || Array.isArray(dosis)) {
    throw new ApiError("La dosis no es válida.");
  }
  const { error } = await supabaseAdmin
    .from("ejercicios_bloque")
    .update({ dosis })
    .eq("id", assignedId);
  throwDatabaseError(error, "No se pudo guardar la dosis");
  return { ok: true };
}

async function saveTeacherNoteAction(payload: Payload) {
  const assignedId = requireString(payload, "assignedId");
  if (typeof payload.nota !== "string") {
    throw new ApiError("La nota para el alumno no es válida.");
  }
  const note = await persistTeacherNote(
    {
      async updateTeacherNote(assignmentId, value) {
        const { error } = await supabaseAdmin
          .from("ejercicios_bloque")
          .update({ nota_profesor: value })
          .eq("id", assignmentId);
        throwDatabaseError(error, "No se pudo guardar la nota para el alumno");
      },
    },
    assignedId,
    payload.nota,
  );
  return { nota_profesor: note };
}

const actions: Record<string, (payload: Payload, trainerEmail: string) => Promise<unknown>> = {
  stats: () => stats(),
  "students.list": () => listStudents(),
  "students.overview": () => studentsOverview(),
  "students.detail": studentDetail,
  "students.create": createStudent,
  "students.toggle": toggleStudent,
  "students.createAccess": createAccessAction,
  "students.revokeAccess": revokeAccessAction,
  "students.accessStatus": accessStatusAction,
  "loads.save": saveTrainerLoadAction,
  "exercises.list": () => listExercises(),
  "exercises.create": createExercise,
  "programs.bootstrap": () => programsBootstrap(),
  "programs.create": createRoutine,
  "programs.open": openRoutine,
  "programs.updateDayTitle": updateDayTitle,
  "programs.updateBlockTitle": updateBlockTitle,
  "programs.addBlock": addBlock,
  "programs.removeBlock": removeBlock,
  "programs.addExercise": addExercise,
  "programs.removeExercise": removeExercise,
  "programs.saveDose": saveDose,
  "programs.saveTeacherNote": saveTeacherNoteAction,
};

export async function POST(request: NextRequest) {
  try {
    const trainerEmail = await requireTrainer(request);
    const body = (await request.json()) as { action?: unknown; payload?: unknown };
    if (typeof body.action !== "string" || !actions[body.action]) {
      throw new ApiError("Acción no válida.");
    }
    const payload =
      body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
        ? (body.payload as Payload)
        : {};
    const data = await actions[body.action](payload, trainerEmail);
    return NextResponse.json({ data });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Error inesperado.";
    console.error("trainer-data:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
