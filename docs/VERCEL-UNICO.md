# ComicKlu en Vercel

Vercel sirve el cliente y la API bajo el mismo origen: React/Vite en `/`, Express en `/api/*` y medios en `/media/*`. PostgreSQL conserva los datos y Supabase Storage los archivos. `APP_URL` debe ser `https://comicklu.vercel.app`.

## Preparar el entorno

En Vercel Production, configurar:

- `APP_URL`, `DATABASE_URL`, `SESSION_SECRET`
- `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET=comicklu-media`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, los `STRIPE_PRICE_*` necesarios y `STRIPE_PORTAL_CONFIGURATION_ID`
- Opcional: `PDF_EXPORT_PRICE_CENTS` para habilitar compras de exportación PDF
- Opcionales: `GEMINI_API_KEY`, `HF_TOKEN` o `POLLINATIONS_API_KEY`; `SMTP_URL` y `MAIL_FROM` para recuperación de contraseña

Generar un secreto de sesión aleatorio (`openssl rand -hex 32`). La aplicación rechaza secretos cortos o el valor de ejemplo y requiere `sslmode=require`, `verify-ca` o `verify-full` en PostgreSQL. Usar un pooler compatible con sesiones. No colocar claves de Supabase, Stripe o IA en variables `VITE_*`, ni guardar secretos en el repositorio. La clave de Supabase debe ser secreta/de servidor; el bucket `comicklu-media` debe ser privado.

## Migraciones

Antes del despliegue inicial, identificar el host de PostgreSQL, verificar que sea la base correcta y tomar un respaldo recuperable. Desde un entorno autorizado y con `DATABASE_URL` apuntando a esa base, ejecutar `npm ci` y `npm run db:migrate` una sola vez. El comando aplica únicamente migraciones pendientes, incluida la tabla de sesiones `0008_session_store` y RLS/revocación de acceso público de `0009_private_tables_rls`. No ejecutar migraciones desde el build ni desde invocaciones serverless. Verificar el esquema con `npm run db:verify`.

## Verificación y límites

El build de Vercel ejecuta `npm run check` y `npm run build:vercel`. Antes de abrir al público:

1. Verificar `/api/health`; debe indicar PostgreSQL, tabla de sesiones y bucket Supabase disponibles.
2. Probar registro, login, aislamiento entre cuentas, persistencia tras reinicio, subida/lectura/borrado de medios y recuperación de contraseña.
3. Probar Stripe en modo test: Checkout, webhook firmado, activación de plan, portal, cancelación y reembolso/baja de plan.
4. Confirmar las cuotas y límites con cuentas de prueba y comprobar logs/alertas del proveedor.

La función serverless limita las subidas desde el navegador a 4 MB. `/media/*` redirige a una URL firmada de Supabase para evitar transmitir archivos grandes a través de la función. El render de video requiere un worker residente y está desactivado en Vercel; no ofrecerlo hasta desplegar y verificar un procesador compatible. Pollinations y otros proveedores de IA son servicios externos sin garantía de disponibilidad; configurar y probar las credenciales elegidas.

Vercel, PostgreSQL, Supabase Storage, Stripe, SMTP y los proveedores de IA requieren configuración externa y credenciales del titular. Una compilación local exitosa no certifica que esos servicios estén listos ni que el despliegue de producción se haya realizado.
