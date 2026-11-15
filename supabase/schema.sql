-- Create tables for Vakhán Center App

-- Ejercicios (Exercise Library)
CREATE TABLE IF NOT EXISTS public.ejercicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL,
  url_video TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alumnos (Students)
CREATE TABLE IF NOT EXISTS public.alumnos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  email TEXT UNIQUE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Accesos personales para alumnos sin correo
CREATE TABLE IF NOT EXISTS public.alumno_accesos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id UUID NOT NULL REFERENCES public.alumnos(id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- Rutinas (Training Programs)
CREATE TABLE IF NOT EXISTS public.rutinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id UUID NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
  meso INTEGER NOT NULL,
  total_mc INTEGER NOT NULL,
  dias_semana INTEGER NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dias (Training Days)
CREATE TABLE IF NOT EXISTS public.dias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rutina_id UUID NOT NULL REFERENCES public.rutinas(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bloques (Exercise Blocks)
CREATE TABLE IF NOT EXISTS public.bloques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dia_id UUID NOT NULL REFERENCES public.dias(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ejercicios en Bloque (Exercises in Blocks)
CREATE TABLE IF NOT EXISTS public.ejercicios_bloque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bloque_id UUID NOT NULL REFERENCES public.bloques(id) ON DELETE CASCADE,
  ejercicio_id UUID NOT NULL REFERENCES public.ejercicios(id) ON DELETE CASCADE,
  dosis JSONB NOT NULL,
  nota_profesor TEXT CHECK (nota_profesor IS NULL OR char_length(nota_profesor) <= 500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cargas (Load/Performance Data)
CREATE TABLE IF NOT EXISTS public.cargas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ejercicio_bloque_id UUID NOT NULL REFERENCES public.ejercicios_bloque(id) ON DELETE RESTRICT,
  alumno_id UUID NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
  mc INTEGER NOT NULL,
  serie INTEGER NOT NULL,
  reps NUMERIC,
  peso NUMERIC,
  rir NUMERIC,
  nota TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

-- Notas del alumno por ejercicio y microciclo
CREATE TABLE IF NOT EXISTS public.notas_ejercicio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id UUID NOT NULL REFERENCES public.alumnos(id) ON DELETE RESTRICT,
  ejercicio_bloque_id UUID NOT NULL REFERENCES public.ejercicios_bloque(id) ON DELETE RESTRICT,
  mc INTEGER NOT NULL,
  nota TEXT NOT NULL CHECK (char_length(nota) BETWEEN 1 AND 500),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (alumno_id, ejercicio_bloque_id, mc)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_alumnos_email ON public.alumnos(email);
CREATE UNIQUE INDEX IF NOT EXISTS alumno_accesos_uno_vigente_por_alumno_key
  ON public.alumno_accesos(alumno_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rutinas_alumno ON public.rutinas(alumno_id);
CREATE UNIQUE INDEX IF NOT EXISTS rutinas_una_activa_por_alumno_key
  ON public.rutinas(alumno_id) WHERE activa;
CREATE INDEX IF NOT EXISTS idx_dias_rutina ON public.dias(rutina_id);
CREATE INDEX IF NOT EXISTS idx_bloques_dia ON public.bloques(dia_id);
CREATE INDEX IF NOT EXISTS idx_ejercicios_bloque_bloque ON public.ejercicios_bloque(bloque_id);
CREATE INDEX IF NOT EXISTS idx_ejercicios_bloque_ejercicio ON public.ejercicios_bloque(ejercicio_id);
CREATE INDEX IF NOT EXISTS idx_cargas_alumno ON public.cargas(alumno_id);
CREATE INDEX IF NOT EXISTS idx_cargas_ejercicio_bloque ON public.cargas(ejercicio_bloque_id);
CREATE INDEX IF NOT EXISTS idx_notas_ejercicio_assignment
  ON public.notas_ejercicio(ejercicio_bloque_id);
CREATE UNIQUE INDEX IF NOT EXISTS ejercicios_categoria_nombre_ci_key
  ON public.ejercicios (LOWER(categoria), LOWER(nombre));
CREATE UNIQUE INDEX IF NOT EXISTS cargas_alumno_assignment_mc_serie_key
  ON public.cargas(alumno_id, ejercicio_bloque_id, mc, serie);

-- Enable Row Level Security (RLS)
ALTER TABLE public.alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumno_accesos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rutinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ejercicios_bloque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_ejercicio ENABLE ROW LEVEL SECURITY;
