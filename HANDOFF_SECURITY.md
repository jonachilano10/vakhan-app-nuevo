# Seguridad de esta copia

Esta copia es independiente del entorno original. No incluye ni autoriza acceso a:

- Supabase de produccion.
- Vercel de produccion.
- Google Cloud u OAuth de produccion.
- Datos personales de alumnos o entrenadores.
- Variables de entorno, tokens, claves o respaldos reales.

## Reglas para el nuevo entorno

1. Crear cuentas, proyectos y credenciales propios.
2. Mantener `SUPABASE_SERVICE_ROLE_KEY` exclusivamente en el servidor.
3. No usar el prefijo `NEXT_PUBLIC_` para secretos.
4. Definir `TRAINER_EMAILS`; si falta, ninguna cuenta recibe rol de entrenador.
5. Usar datos ficticios o anonimizados durante el desarrollo.
6. Mantener el repositorio privado y exigir autenticacion de dos factores.
7. Revisar Pull Requests y esperar CI exitoso antes de desplegar.
8. No copiar archivos `.env`, respaldos o exportaciones de otros entornos.

## Preparacion para publicar

- Configurar secretos directamente en el proveedor de hosting.
- Crear un cliente OAuth separado por entorno.
- Aplicar el principio de menor privilegio.
- Verificar RLS y autorizacion del servidor antes de cargar datos reales.
- Ejecutar lint, tests, TypeScript y build.
