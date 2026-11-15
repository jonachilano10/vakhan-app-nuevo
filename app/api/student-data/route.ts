import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

import { ApiError } from "@/lib/api-error";
import { throwDatabaseError as databaseError } from "@/lib/database-errors";
import { latestLoadsBefore } from "@/lib/load-history";
import { requireStudentIdentity, type StudentIdentity } from "@/lib/server-auth";
import { verifySessionAccess } from "@/lib/student-access";
import { studentAccessRepository } from "@/lib/student-access-server";
import { saveStudentLoad } from "@/lib/student-load-actions";
import { saveStudentNote } from "@/lib/student-note-actions";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { activeMicrocycle } from "@/lib/training-progress";

export const dynamic = "force-dynamic";

type Payload = Record<string, unknown>;

interface StudentRow {
  id: string;
  nombre: string;
  email: string | null;
  activo: boolean;
}

interface RoutineRow {
  id: string;
  meso: number;
  total_mc: number;
  dias_semana: number;
  activa: boolean;
}

interface DayRow {
  id: string;
  numero: number;
  titulo: string;
}

interface BlockRow {
  id: string;
  dia_id: string;
  numero: number;
  titulo: string;
}

interface AssignmentRow {
  id: string;
  bloque_id: string;
  ejercicio_id: string;
  dosis: Record<string, unknown>;
  nota_profesor: string | null;
}

interface ExerciseRow {
  id: string;
  nombre: string;
  categoria: string;
  url_video: string | null;
}

interface LoadRow {
  id: string;
  ejercicio_bloque_id: string;
  mc: number;
  serie: number;
  reps: number | null;
  peso: number | null;
  rir: number | null;
}

interface StudentNoteRow {
  id: string;
  ejercicio_bloque_id: string;
  mc: number;
  nota: string;
}

interface RoutineGraph {
  student: StudentRow;
  routine: RoutineRow | null;
  days: DayRow[];
  blocks: BlockRow[];
  assignments: AssignmentRow[];
  exercises: ExerciseRow[];
}

function stringField(payload: Payload, key: string) {
  const value = payload[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(`El campo ${key} es obligatorio.`);
  }
  return value.trim();
}

function integerField(payload: Payload, key: string, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const value = Number(payload[key]);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ApiError(`El campo ${key} no es válido.`);
  }
  return value;
}

function numericField(payload: Payload, key: string, min = 0) {
  const value = Number(payload[key]);
  if (!Number.isFinite(value) || value < min) {
    throw new ApiError(`El campo ${key} no es válido.`);
  }
  return value;
}

function nullableNumericField(payload: Payload, key: string, min = 0) {
  const raw = payload[key];
  if (raw === null || raw === "" || typeof raw === "undefined") return null;
  return numericField(payload, key, min);
}

async function authenticatedStudent(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const identity = requireStudentIdentity({
    email: token?.email,
    alumnoId: token?.alumnoId,
    accessId: token?.accessId,
  });
  if (identity.kind === "email") return identity;

  const verified = await verifySessionAccess(studentAccessRepository, identity.accessId);
  if (verified.alumnoId !== identity.alumnoId) {
    throw new ApiError("Tu acceso venció. Pedile un QR nuevo al profe.", 401);
  }
  return identity;
}

async function loadRoutineGraph(identity: StudentIdentity): Promise<RoutineGraph> {
  let studentQuery = supabaseAdmin
    .from("alumnos")
    .select("id,nombre,email,activo");
  studentQuery = identity.kind === "id"
    ? studentQuery.eq("id", identity.alumnoId)
    : studentQuery.eq("email", identity.email);
  const { data: studentData, error: studentError } = await studentQuery.maybeSingle();
  databaseError(studentError, "No se pudo buscar el alumno");
  if (!studentData) {
    throw new ApiError(
      "Tu correo no está registrado como alumno. Pedile al entrenador que lo agregue.",
      404,
    );
  }

  const student = studentData as StudentRow;
  if (!student.activo) throw new ApiError("Tu acceso como alumno está inactivo.", 403);

  const { data: routineData, error: routineError } = await supabaseAdmin
    .from("rutinas")
    .select("id,meso,total_mc,dias_semana,activa")
    .eq("alumno_id", student.id)
    .eq("activa", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  databaseError(routineError, "No se pudo cargar la rutina");

  if (!routineData) {
    return { student, routine: null, days: [], blocks: [], assignments: [], exercises: [] };
  }

  const routine = routineData as RoutineRow;
  const { data: dayData, error: dayError } = await supabaseAdmin
    .from("dias")
    .select("id,numero,titulo")
    .eq("rutina_id", routine.id)
    .order("numero");
  databaseError(dayError, "No se pudieron cargar los días");
  const days = (dayData ?? []) as DayRow[];

  const dayIds = days.map((day) => day.id);
  let blocks: BlockRow[] = [];
  if (dayIds.length) {
    const { data, error } = await supabaseAdmin
      .from("bloques")
      .select("id,dia_id,numero,titulo")
      .in("dia_id", dayIds)
      .order("numero");
    databaseError(error, "No se pudieron cargar los bloques");
    blocks = (data ?? []) as BlockRow[];
  }

  const blockIds = blocks.map((block) => block.id);
  let assignments: AssignmentRow[] = [];
  if (blockIds.length) {
    const { data, error } = await supabaseAdmin
      .from("ejercicios_bloque")
      .select("id,bloque_id,ejercicio_id,dosis,nota_profesor")
      .in("bloque_id", blockIds)
      .order("created_at");
    databaseError(error, "No se pudieron cargar los ejercicios asignados");
    assignments = (data ?? []) as AssignmentRow[];
  }

  const exerciseIds = [...new Set(assignments.map((assignment) => assignment.ejercicio_id))];
  let exercises: ExerciseRow[] = [];
  if (exerciseIds.length) {
    const { data, error } = await supabaseAdmin
      .from("ejercicios")
      .select("id,nombre,categoria,url_video")
      .in("id", exerciseIds)
      .order("nombre");
    databaseError(error, "No se pudieron cargar los ejercicios");
    exercises = (data ?? []) as ExerciseRow[];
  }

  return { student, routine, days, blocks, assignments, exercises };
}

async function loadStudentLoads(studentId: string, assignmentIds: string[]) {
  if (!assignmentIds.length) return [] as LoadRow[];
  const { data, error } = await supabaseAdmin
    .from("cargas")
    .select("id,ejercicio_bloque_id,mc,serie,reps,peso,rir")
    .eq("alumno_id", studentId)
    .in("ejercicio_bloque_id", assignmentIds)
    .order("mc")
    .order("serie");
  databaseError(error, "No se pudieron cargar los registros de entrenamiento");
  return (data ?? []) as LoadRow[];
}

async function loadStudentNotes(studentId: string, assignmentIds: string[]) {
  if (!assignmentIds.length) return [] as StudentNoteRow[];
  const { data, error } = await supabaseAdmin
    .from("notas_ejercicio")
    .select("id,ejercicio_bloque_id,mc,nota")
    .eq("alumno_id", studentId)
    .in("ejercicio_bloque_id", assignmentIds);
  databaseError(error, "No se pudieron cargar las notas de entrenamiento");
  return (data ?? []) as StudentNoteRow[];
}

async function routineView(identity: StudentIdentity) {
  const graph = await loadRoutineGraph(identity);
  if (!graph.routine) return { routine: null };

  const assignmentIds = graph.assignments.map((assignment) => assignment.id);
  const [loads, studentNotes] = await Promise.all([
    loadStudentLoads(graph.student.id, assignmentIds),
    loadStudentNotes(graph.student.id, assignmentIds),
  ]);
  const microcycle = activeMicrocycle(graph.routine, graph.assignments, loads);
  const currentLoads: Record<string, { id: string; reps: string; peso: string; rir: string }> = {};
  const previousLoads = latestLoadsBefore(loads, microcycle.current);

  for (const load of loads) {
    const key = `${load.ejercicio_bloque_id}:${load.mc}:${load.serie}`;
    if (load.mc === microcycle.current) {
      currentLoads[key] = {
        id: load.id,
        reps: load.reps === null ? "" : String(load.reps),
        peso: load.peso === null ? "" : String(load.peso),
        rir: load.rir === null ? "" : String(load.rir),
      };
    }
  }

  const exerciseById = new Map(graph.exercises.map((exercise) => [exercise.id, exercise]));
  const days = graph.days.map((day) => ({
    ...day,
    bloques: graph.blocks
      .filter((block) => block.dia_id === day.id)
      .sort((first, second) => first.numero - second.numero)
      .map((block) => ({
        id: block.id,
        numero: block.numero,
        titulo: block.titulo,
        ejercicios: graph.assignments.flatMap((assignment) => {
          if (assignment.bloque_id !== block.id) return [];
          const exercise = exerciseById.get(assignment.ejercicio_id);
          if (!exercise) return [];
          return [{
            assignmentId: assignment.id,
            exerciseId: exercise.id,
            nombre: exercise.nombre,
            categoria: exercise.categoria,
            url_video: exercise.url_video,
            dosis: Object.fromEntries(
              Object.entries(assignment.dosis ?? {}).map(([key, value]) => [key, String(value ?? "")]),
            ),
            nota_profesor: assignment.nota_profesor,
            notas: Object.fromEntries(
              studentNotes
                .filter((note) => note.ejercicio_bloque_id === assignment.id)
                .map((note) => [String(note.mc), note.nota]),
            ),
          }];
        }),
      })),
  }));

  return {
    routine: {
      id: graph.routine.id,
      meso: graph.routine.meso,
      total_mc: graph.routine.total_mc,
      dias: days,
    },
    activeMicrocycle: microcycle.current,
    programComplete: microcycle.complete,
    loads: currentLoads,
    previousLoads,
  };
}

async function saveLoad(identity: StudentIdentity, payload: Payload) {
  const assignmentId = stringField(payload, "assignmentId");
  const mc = integerField(payload, "mc", 1, 52);
  const serie = integerField(payload, "serie", 1, 20);
  const reps = nullableNumericField(payload, "reps");
  const peso = nullableNumericField(payload, "peso");
  const rir = nullableNumericField(payload, "rir");
  const graph = await loadRoutineGraph(identity);

  if (!graph.routine) throw new ApiError("No tenés una rutina asignada.", 404);
  return saveStudentLoad(
    {
      async findLoad(studentId, input) {
        const { data, error } = await supabaseAdmin
          .from("cargas")
          .select("id")
          .eq("alumno_id", studentId)
          .eq("ejercicio_bloque_id", input.assignmentId)
          .eq("mc", input.mc)
          .eq("serie", input.serie)
          .maybeSingle();
        databaseError(error, "No se pudo verificar la carga");
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
        databaseError(error, "No se pudo actualizar la carga");
        if (!data) throw new ApiError("No se pudo actualizar la carga.", 500);
        return data;
      },
      async insertLoad(studentId, input, audit) {
        const { data, error } = await supabaseAdmin
          .from("cargas")
          .insert({
            ejercicio_bloque_id: input.assignmentId,
            alumno_id: studentId,
            mc: input.mc,
            serie: input.serie,
            reps: input.reps,
            peso: input.peso,
            rir: input.rir,
            updated_by: audit.updatedBy,
          })
          .select("id")
          .single();
        if (error?.code === "23505") throw error;
        databaseError(
          error,
          "No se pudo guardar la carga",
          "Esa serie ya fue registrada.",
        );
        if (!data) throw new ApiError("No se pudo guardar la carga.", 500);
        return data;
      },
    },
    {
      studentId: graph.student.id,
      totalMicrocycles: graph.routine.total_mc,
      assignmentIds: graph.assignments.map((assignment) => assignment.id),
    },
    { assignmentId, mc, serie, reps, peso, rir },
  );
}

async function saveNote(identity: StudentIdentity, payload: Payload) {
  const assignmentId = stringField(payload, "assignmentId");
  const mc = integerField(payload, "mc", 1, 52);
  if (typeof payload.nota !== "string") throw new ApiError("La nota no es válida.");
  const graph = await loadRoutineGraph(identity);
  if (!graph.routine) throw new ApiError("No tenés una rutina activa.", 404);

  return saveStudentNote(
    {
      async findNote(studentId, targetAssignmentId, microcycle) {
        const { data, error } = await supabaseAdmin
          .from("notas_ejercicio")
          .select("id")
          .eq("alumno_id", studentId)
          .eq("ejercicio_bloque_id", targetAssignmentId)
          .eq("mc", microcycle)
          .maybeSingle();
        databaseError(error, "No se pudo verificar la nota");
        return data;
      },
      async insertNote(studentId, input) {
        const { data, error } = await supabaseAdmin
          .from("notas_ejercicio")
          .insert({
            alumno_id: studentId,
            ejercicio_bloque_id: input.assignmentId,
            mc: input.mc,
            nota: input.note,
          })
          .select("id")
          .single();
        if (error?.code === "23505") throw error;
        databaseError(error, "No se pudo guardar la nota");
        if (!data) throw new ApiError("No se pudo guardar la nota.", 500);
        return data;
      },
      async updateNote(noteId, studentId, note) {
        const { data, error } = await supabaseAdmin
          .from("notas_ejercicio")
          .update({ nota: note, updated_at: new Date().toISOString() })
          .eq("id", noteId)
          .eq("alumno_id", studentId)
          .select("id")
          .single();
        databaseError(error, "No se pudo actualizar la nota");
        if (!data) throw new ApiError("No se pudo actualizar la nota.", 500);
        return data;
      },
      async deleteNote(noteId, studentId) {
        const { error } = await supabaseAdmin
          .from("notas_ejercicio")
          .delete()
          .eq("id", noteId)
          .eq("alumno_id", studentId);
        databaseError(error, "No se pudo borrar la nota");
      },
    },
    {
      studentId: graph.student.id,
      totalMicrocycles: graph.routine.total_mc,
      assignmentIds: graph.assignments.map((assignment) => assignment.id),
    },
    { assignmentId, mc, note: payload.nota },
  );
}

async function progressBootstrap(identity: StudentIdentity) {
  const graph = await loadRoutineGraph(identity);
  if (!graph.routine) return [];

  return graph.exercises.map((exercise) => ({
    id: exercise.id,
    nombre: exercise.nombre,
    categoria: exercise.categoria,
    assignmentIds: graph.assignments
      .filter((assignment) => assignment.ejercicio_id === exercise.id)
      .map((assignment) => assignment.id),
  }));
}

async function progressDetails(identity: StudentIdentity, payload: Payload) {
  const exerciseId = stringField(payload, "exerciseId");
  const graph = await loadRoutineGraph(identity);
  if (!graph.routine) return [];

  const assignmentIds = graph.assignments
    .filter((assignment) => assignment.ejercicio_id === exerciseId)
    .map((assignment) => assignment.id);
  if (!assignmentIds.length) throw new ApiError("El ejercicio no pertenece a tu rutina.", 403);

  const { data, error } = await supabaseAdmin
    .from("cargas")
    .select("id,mc,serie,peso,reps,rir")
    .eq("alumno_id", graph.student.id)
    .in("ejercicio_bloque_id", assignmentIds)
    .order("mc")
    .order("serie");
  databaseError(error, "No se pudo cargar el progreso");
  return data ?? [];
}

export async function POST(request: NextRequest) {
  try {
    const identity = await authenticatedStudent(request);
    const body = (await request.json()) as { action?: unknown; payload?: unknown };
    const payload =
      body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
        ? (body.payload as Payload)
        : {};

    let data: unknown;
    switch (body.action) {
      case "routine":
        data = await routineView(identity);
        break;
      case "loads.save":
        data = await saveLoad(identity, payload);
        break;
      case "notes.save":
        data = await saveNote(identity, payload);
        break;
      case "progress.bootstrap":
        data = await progressBootstrap(identity);
        break;
      case "progress.details":
        data = await progressDetails(identity, payload);
        break;
      default:
        throw new ApiError("Acción no válida.");
    }

    return NextResponse.json({ data });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Error inesperado.";
    console.error("student-data:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
