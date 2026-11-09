# Etapa 1 — Verificación de la base de datos de ComicKlu

**No aplicar migraciones a una base de datos sin identificar.** El despliegue único es `https://comicklu.vercel.app`. La aplicación usa `DATABASE_URL` o `POSTGRES_URL`, que puede apuntar a un proyecto diferente del visible en las conexiones de Supabase.

## Verificación segura
1. Identificar el **host** de la base de datos vinculada al proyecto ComicKlu en Vercel; no compartir contraseña ni cadena completa.
2. Confirmar en el panel de la base de datos que existen las tablas `users`, `comics`, `panels`, `assets` y `stripe_events`. Si no existen, detenerse: podría ser otra base.
3. Realizar un respaldo recuperable antes de migrar, y registrar la versión del esquema.
4. Ejecutar `npm run db:verify` en un entorno autorizado con `DATABASE_URL` configurada. **Este comando solo consulta metadatos; no modifica datos.**
5. Revisar las migraciones pendientes y el historial de `drizzle.__drizzle_migrations`.
6. Solo tras confirmar el proyecto y el respaldo, aplicar las migraciones pendientes una sola vez con `npm run db:migrate` desde un entorno autorizado y ejecutar nuevamente `npm run db:verify`.
7. Verificar que la conexión de Vercel Production apunta a esa misma base. No correr `runMigrations()` en invocaciones serverless.

## Criterio de cierre
- Coincidencia demostrable entre la base y el proyecto de producción.
- Tablas y columnas nuevas presentes.
- RLS habilitado en las tablas sensibles.
- Historial de migraciones consistente.
- Respaldo previo comprobado.

Si falta alguno de estos puntos, **la etapa no está completada** y no se debe activar la compra de PDF ni los comentarios en producción.
