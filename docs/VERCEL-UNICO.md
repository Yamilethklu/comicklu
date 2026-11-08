# ComicKlu — solo Vercel

**Dominio público exclusivo:** https://comicklu.vercel.app/

Vercel sirve React/Vite en `/`, Express en una función bajo `/api/*` y media por `/media/*`, usando el mismo dominio y la misma sesión. Supabase sigue siendo la base de datos y almacenamiento; Stripe conserva pagos, pero ya **no se utiliza ningún proxy a Render**.

## Configuración necesaria de Vercel (Production)

En **Vercel > Project Settings > Environment Variables**, verificar por nombre y configurar directamente, sin compartir valores:
- `APP_URL=https://comicklu.vercel.app`, `SESSION_SECRET`, `DATABASE_URL`
- `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET=comicklu-media`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_PREMIUM_MONTHLY`, `STRIPE_PRICE_PREMIUM_YEARLY`, `STRIPE_PORTAL_CONFIGURATION_ID`
- Las variables de correo e IA si se van a utilizar.

No configurar `PUBLIC_SITE_URL`, `RENDER_EXTERNAL_URL` o `FFMPEG_PATH=/usr/bin/ffmpeg` en Vercel. La configuración `VERCEL_URL` es específica de cada despliegue; establecer `APP_URL` fija el dominio oficial para las redirecciones.

## Base de datos y webhooks

Las migraciones se deben ejecutar **una vez antes de activar tráfico público**, sobre PostgreSQL con las credenciales seguras, nunca durante cada invocación serverless. Consultar el estado de `migrations/meta/_journal.json` y de `drizzle.__drizzle_migrations`; no repetir manualmente migraciones si ya se aplicaron. No se han ejecutado cambios sobre la base real.

**Mover el webhook de Stripe** al mismo dominio: `https://comicklu.vercel.app/api/billing/webhook`. Actualizar en el Dashboard el endpoint y su secreto correspondiente; no dejar el endpoint antiguo activo cuando la nueva URL haya sido validada. Esta actualización de Stripe requiere acceso autorizado del titular.

## Funciones que necesitan adaptación adicional

- **Video FFmpeg 1080p:** el worker residente de Render no puede ejecutarse permanentemente en Vercel. Temporalmente la solicitud devuelve 503 **sin descontar cuota**; implementar procesamiento por petición, Vercel Queues/Workflow o render externo antes de ofrecer videos.
- **Archivos:** se exige Supabase Storage para persistencia. Los medios grandes pueden superar el límite de respuesta de Vercel Functions (4.5 MB); migrar descargas a URLs firmadas o streaming compatible.
- **Imágenes y audios:** la carga directa por función también está limitada por el tamaño máximo de solicitud de Vercel; archivos mayores requieren subida directa a Supabase.
- **Pruebas:** comprobar firmas webhooks en el entorno de Vercel; el parsing de peticiones debe conservar los bytes originales para Stripe.
- El proyecto de Vercel **no es accesible desde la conexión de Vercel actual**; no se ha confirmado ni modificado su configuración en Dashboard ni se ha realizado un despliegue.
- La app Android/iOS sigue consumiendo esta misma API por HTTPS (no requiere Render).

## Eliminar Render definitivamente

**Después de verificar Vercel**: desactivar Auto Deploy y eliminar el servicio `comicklu-1` del Dashboard de Render bajo la cuenta que lo administra. Es una operación externa y no está completada por quitar `render.yaml` del repositorio. Comprobar primero registro, login, archivo, Stripe y el dominio público. Mantener una copia de seguridad de PostgreSQL y Storage.

Este cambio no certifica que todos los flujos ya funcionen en Vercel: se requiere CI y pruebas de integración antes de la publicación definitiva.
