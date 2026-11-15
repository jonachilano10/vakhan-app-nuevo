# Vakhan App - contexto tecnico sanitizado

Aplicacion Next.js 16 con TypeScript, Tailwind, Supabase y NextAuth. Esta copia no
contiene datos, secretos, historial Git ni accesos a infraestructura preexistente.

## Funcionalidad

- Panel del entrenador con alumnos, biblioteca y constructor de rutinas.
- Rutinas con dias, bloques editables, varios ejercicios y dosis por microciclo.
- Progresiones automaticas o libres e intensidad RIR/RPE opcional.
- App mobile-first del alumno con autoguardado de reps, peso y RIR.
- Referencias de cargas anteriores, notas y grafico de progreso.
- Acceso del alumno por Google o enlace/QR personal con token almacenado como hash.
- Reproduccion interna de videos compatibles.

## Arquitectura de seguridad

- Las operaciones con Supabase pasan por APIs de servidor.
- `SUPABASE_SERVICE_ROLE_KEY` se usa solo en `lib/supabase-admin.ts`.
- La API del entrenador autoriza contra `TRAINER_EMAILS`.
- Si `TRAINER_EMAILS` no esta definido, ninguna cuenta obtiene rol de entrenador.
- La API del alumno deriva su identidad de la sesion y no acepta un `alumno_id`
  proporcionado por el navegador.
- Las tablas tienen RLS y las restricciones de integridad estan en
  `supabase/schema.sql`.

## Instalacion nueva

1. Crear Supabase, Google OAuth y hosting propios.
2. Ejecutar `supabase/schema.sql` en una base vacia.
3. Crear `.env.local` desde `.env.example`.
4. Usar datos ficticios.
5. Ejecutar todas las verificaciones de `README.md`.

Los archivos de `supabase/migrations/` son historial tecnico. No deben ejecutarse en
bloque sobre una base ya creada con `schema.sql`.

## Criterios para cambios

- No exponer secretos al cliente.
- Mantener la separacion entre entrenador y alumno.
- Preservar el historial de cargas; no agregar borrado en cascada.
- Mantener la interfaz del alumno mobile-first.
- Agregar tests cuando cambie el comportamiento.
- Ejecutar lint, tests, TypeScript y build antes de integrar.

Consultar `HANDOFF_SECURITY.md` y `DEPLOYMENT.md` antes de conectar servicios reales.
