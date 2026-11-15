# Vakhan App - copia de desarrollo

Aplicacion de entrenamiento construida con Next.js 16, TypeScript, Tailwind,
Supabase y NextAuth.

Esta copia fue preparada para iniciar un repositorio y una infraestructura nuevos.
No contiene historial Git, datos reales, secretos ni conexiones con el entorno de
produccion original.

## Desarrollo local

1. Crear un proyecto Supabase propio.
2. Ejecutar `supabase/schema.sql` en una base vacia.
3. Crear un cliente OAuth web propio en Google Cloud.
4. Copiar `.env.example` como `.env.local` y completar valores del entorno nuevo.
5. Instalar dependencias con `npm ci`.
6. Iniciar la aplicacion con `npm run dev`.
7. Abrir `http://localhost:3000`.

No utilizar credenciales ni datos de la aplicacion original. Para pruebas deben usarse
usuarios y datos ficticios.

## Verificaciones

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
```

## Base de datos

`supabase/schema.sql` representa el esquema para instalaciones nuevas. Los archivos de
`supabase/migrations/` documentan la evolucion historica del esquema y no deben
ejecutarse en bloque sobre una base creada desde `schema.sql`.

Consultar `HANDOFF_SECURITY.md` antes de configurar hosting o compartir accesos.
