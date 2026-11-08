# Verificación de compilación en Vercel

Vercel debe instalar las dependencias de desarrollo, necesarias para compilar TypeScript, Vite y la función Node Express:
`npm ci --include=dev`.

Luego ejecuta `npm run check && npm run build:vercel`. Un error TS2688 ("Cannot find type definition file for 'node'") indica que la definición `@types/node` no está disponible para el compilador; existe en `devDependencies` y por eso la instalación del build debe incluirla. El verificador no debería ignorar este error.

Este cambio solo modifica la construcción, no los valores de entorno ni las claves.

No declarar listo para recibir clientes hasta validar `/api/health`, `/api/auth/me`, login/registro, precios y webhooks. Las variables que requiere `server/env.ts` deben estar presentes **por nombre** en Vercel: `DATABASE_URL`, `SESSION_SECRET`, `APP_URL`, `STRIPE_WEBHOOK_SECRET` y `STRIPE_PRICE_*`, según las funciones activas. Los secretos no se deben incluir en el repositorio.
