# Despliegue único de ComicKlu

**Único destino web:** Render, servicio `comicklu-1`, rama `main`, `https://comicklu-1.onrender.com`.

La misma aplicación Express publica el frontend Vite desde `dist/public`, la API `/api`, los medios `/media`, los webhooks Stripe y el worker FFmpeg en **un único servicio web Render**. El `Dockerfile` construye Vite y Express en la misma imagen. `render.yaml` declara solo un servicio web, sin base de datos de Render.

- **GitHub Actions** solo comprueba tipos, build y tests: no despliega otra copia del sitio.
- **Supabase** guarda PostgreSQL, sesiones y archivos privados: es un servicio de datos, no otra web de ComicKlu.
- **Stripe** procesa pagos: tampoco es un despliegue web separado.
- **No usar Vercel para ComicKlu**. Se elimina `vercel.json` del repositorio para no mantener una segunda configuración de publicación. Si un proyecto de Vercel está conectado al mismo repositorio en otro equipo/cuenta, desconectar Git desde Settings > Git o eliminar ese proyecto desde el Dashboard del propietario. Eliminar `vercel.json` **por sí solo no desactiva** una integración Git de Vercel.
- Si hay varios servicios **Render** conectados al mismo repositorio, conservar solo `comicklu-1` y desactivar Auto-Deploy o borrar los demás desde el Dashboard del propietario **después** de comprobar que ninguno sirve un dominio activo. Nunca borrar el servicio actual sin verificarlo.
- En Render, establecer `APP_URL=https://comicklu-1.onrender.com` y utilizar la misma URL como retorno de Stripe, correo de recuperación, portal y web. `PUBLIC_SITE_URL` deja de usarse; se puede retirar en Environment.
- Mantener el webhook de Stripe en `https://comicklu-1.onrender.com/api/billing/webhook`.
- La aplicación nativa Capacitor (Android/iOS) sigue siendo un paquete distinto; consume la **misma API de Render**. Publicar apps en las tiendas no crea un segundo backend.

## Publicación

Una vez fusionados cambios revisados en `main`, Render construye el `Dockerfile` y arranca `node dist/server.js`. No es necesario lanzar `vercel deploy` ni publicar por GitHub Actions. **Un push en GitHub no garantiza un despliegue correcto**: revisar el evento de Render, el endpoint `/api/health` y las pruebas de registro y pago.

## Limitación

Render Free puede suspender la app por inactividad y puede no tener recursos suficientes para videos 1080p. Un único despliegue evita duplicación, pero no garantiza disponibilidad ni velocidad.
