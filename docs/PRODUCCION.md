# Preparación de producción

El destino web de este proyecto es Vercel. La arquitectura, variables requeridas, migraciones y límites conocidos están en [VERCEL-UNICO.md](VERCEL-UNICO.md); no seguir las antiguas instrucciones de Render.

## Antes de habilitar tráfico

1. Configurar `DATABASE_URL`, `SESSION_SECRET`, `APP_URL=https://comicklu.vercel.app`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` y `SUPABASE_STORAGE_BUCKET=comicklu-media` en Vercel Production.
2. Confirmar que `DATABASE_URL` apunta al PostgreSQL de producción esperado, tomar un respaldo y ejecutar `npm run db:migrate` desde un entorno autorizado. No ejecutar migraciones desde el build ni desde una función serverless.
3. Configurar Stripe, correo e IA solo si se ofrecerán esas funciones. Mantener Checkout desactivado hasta tener claves, precios y webhook de producción coincidentes.
4. Desplegar y comprobar `/api/health`, registro/login, persistencia, subida y descarga de medios, pagos en modo de prueba y recuperación de contraseña.

Los renders de video no están disponibles en Vercel. Las subidas desde el navegador están limitadas a 4 MB para permanecer bajo el límite de solicitud de la función. Estas funciones no deben anunciarse como disponibles hasta desplegar un trabajador de video y una vía de subida directa a Storage, respectivamente.
