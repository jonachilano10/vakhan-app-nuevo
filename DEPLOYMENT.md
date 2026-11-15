# Despliegue de un entorno nuevo

Este repositorio no esta conectado con ninguna infraestructura existente. Todos los
servicios y credenciales deben pertenecer al nuevo responsable del proyecto.

## 1. Base de datos

- Crear un proyecto Supabase nuevo.
- Ejecutar `supabase/schema.sql` una sola vez sobre una base vacia.
- No ejecutar en bloque las migraciones historicas despues de crear la base desde el
  esquema de referencia.
- Confirmar que RLS este habilitado en todas las tablas de `public`.
- Cargar exclusivamente datos ficticios durante el desarrollo.

## 2. Variables

Configurar las variables indicadas en `.env.example`:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `TRAINER_EMAILS`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

La service role es un secreto exclusivo del servidor. Nunca debe incluirse en Git ni
exponerse como variable `NEXT_PUBLIC_*`.

## 3. OAuth

- Crear un cliente OAuth web nuevo.
- Para desarrollo, autorizar `http://localhost:3000` y
  `http://localhost:3000/api/auth/callback/google`.
- Para produccion, registrar el dominio HTTPS nuevo y su callback
  `https://DOMINIO_NUEVO/api/auth/callback/google`.

## 4. Validacion

```bash
npm ci
npm run lint
npm test
npx tsc --noEmit
npm run build
```

Despues del despliegue, probar autenticacion, separacion de roles, alta de alumnos,
constructor de rutinas, autoguardado y revocacion de accesos por QR.

## 5. Operacion

- Mantener backups y registro de cambios.
- Aplicar migraciones nuevas manualmente y de a una.
- Probar cada migracion en una copia antes de produccion.
- No almacenar datos personales hasta completar la revision de seguridad y privacidad.
