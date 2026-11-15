import * as nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import XLSX from "xlsx";

const nextEnvModule = nextEnv as typeof nextEnv & { default?: typeof nextEnv };
const loadEnvConfig =
  nextEnvModule.loadEnvConfig ?? nextEnvModule.default?.loadEnvConfig;

if (!loadEnvConfig) {
  throw new Error("No se pudo cargar la configuración de entorno de Next.js");
}

loadEnvConfig(process.cwd());

interface Exercise {
  nombre: string;
  categoria: string;
  url_video: string;
}

const URL_PATTERN = /(?:https?:\/\/|www\.|youtube\.com\/|youtu\.be\/)[^\s]+/i;
const INSERT_BATCH_SIZE = 500;
const SELECT_PAGE_SIZE = 1000;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const details = error as Record<string, unknown>;
    const fields = ["code", "message", "details", "hint", "statusText"]
      .flatMap((field) =>
        details[field] ? [`${field}: ${String(details[field])}`] : [],
      );

    if (fields.length > 0) return fields.join(" | ");

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

function parseExerciseCell(value: unknown): Pick<Exercise, "nombre" | "url_video"> | null {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;

  const urlMatch = text.match(URL_PATTERN);
  if (!urlMatch || urlMatch.index === undefined) {
    const nombre = text.replace(/\s*(?:-+\s*>?|[.·–—:])+\s*$/u, "").trim();
    return nombre ? { nombre, url_video: "" } : null;
  }

  const rawName = text.slice(0, urlMatch.index);
  const nombre = rawName
    .replace(/\s*(?:-+\s*>?|[.·–—:])+\s*$/u, "")
    .trim();
  const url_video = urlMatch[0].replace(/[),.;]+$/, "").trim();

  return nombre ? { nombre, url_video } : null;
}

function readExercises(filePath: string): Exercise[] {
  const workbook = XLSX.readFile(filePath);
  const worksheet = workbook.Sheets.EJERCICIOS;

  if (!worksheet) {
    throw new Error("No se encontró la hoja 'EJERCICIOS'");
  }

  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:A1");
  const exercises = new Map<string, Exercise>();

  // La planilla usa columnas pares para la mayoría de las categorías, pero las
  // últimas categorías están contiguas. Tomar cada encabezado no vacío evita
  // perder esas columnas y sigue ignorando las columnas separadoras vacías.
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const header = worksheet[XLSX.utils.encode_cell({ r: 0, c: column })];
    const categoria = String(header?.v ?? "").trim();
    if (!categoria) continue;

    for (let row = 1; row <= range.e.r; row += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
      const parsed = parseExerciseCell(cell?.v);
      if (!parsed) continue;

      const exercise: Exercise = { categoria, ...parsed };
      const key = `${categoria.toLocaleLowerCase("es")}\u0000${exercise.nombre.toLocaleLowerCase("es")}`;
      exercises.set(key, exercise);
    }
  }

  return Array.from(exercises.values());
}

async function importExercises() {
  const dryRun = process.argv.includes("--dry-run");
  const argument = process.argv.slice(2).find((value) => value !== "--dry-run");
  if (!argument) {
    throw new Error(
      "Uso: npm run import:exercises -- \"<ruta-al-archivo-PLAN-BASE.xlsx>\" [--dry-run]",
    );
  }

  const filePath = path.resolve(argument);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${filePath}`);
  }

  const exercises = readExercises(filePath);
  console.log(`Se encontraron ${exercises.length} ejercicios únicos en la planilla.`);

  if (dryRun) {
    const categories = new Set(exercises.map((exercise) => exercise.categoria));
    console.log(`Validación terminada: ${categories.size} categorías, sin escribir en Supabase.`);
    return;
  }

  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const existingKeys = new Set<string>();
  for (let from = 0; ; from += SELECT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("ejercicios")
      .select("nombre,categoria")
      .range(from, from + SELECT_PAGE_SIZE - 1);

    if (error) throw error;

    for (const exercise of data ?? []) {
      existingKeys.add(
        `${exercise.categoria.toLocaleLowerCase("es")}\u0000${exercise.nombre.toLocaleLowerCase("es")}`,
      );
    }

    if (!data || data.length < SELECT_PAGE_SIZE) break;
  }

  const pending = exercises.filter(
    (exercise) =>
      !existingKeys.has(
        `${exercise.categoria.toLocaleLowerCase("es")}\u0000${exercise.nombre.toLocaleLowerCase("es")}`,
      ),
  );

  for (let index = 0; index < pending.length; index += INSERT_BATCH_SIZE) {
    const batch = pending.slice(index, index + INSERT_BATCH_SIZE);
    const { error } = await supabase.from("ejercicios").insert(batch);
    if (error) throw error;
  }

  console.log(
    `Importación terminada: ${pending.length} insertados, ${exercises.length - pending.length} ya existían.`,
  );
}

importExercises().catch((error: unknown) => {
  console.error(`Error al importar ejercicios: ${describeError(error)}`);
  process.exit(1);
});
