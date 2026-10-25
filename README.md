# Panelforge — plataforma de creación de cómics con IA

Estudio web para escribir historias y crear cómics, manga, anime y cyberpunk: guion con IA, imágenes con IA
(o subidas/por enlace), voces con IA, vista previa tipo página, exportación JSON y **video MP4 animado**.
Cuentas de usuario, biblioteca en la nube y **suscripciones Gratis / Pro / Premium con Stripe**.

**Stack:** React + Vite + Tailwind · Express 5 · PostgreSQL (Drizzle) · Stripe · IA gratuita (Pollinations / Gemini / Hugging Face / espeak-ng) · ffmpeg.

## IA gratuita (sin pagar OpenAI)
Por defecto (`AI_PROVIDER=free`) no necesitas ninguna clave:
- **Guion:** Gemini si pones `GEMINI_API_KEY` (gratis) → si no, Pollinations.
- **Imágenes:** Hugging Face si pones `HF_TOKEN` (gratis) → si no, Pollinations.
- **Voz:** Pollinations → si falla, **espeak-ng local** (siempre funciona, voz robótica; ya viene en el Dockerfile).
- Las peticiones a Pollinations se hacen de una en una (cola) para respetar su límite gratuito; si la IA falla, **no se descuenta** del plan del usuario.
- Pollinations es un servicio gratuito de terceros: sin garantía de disponibilidad ni calidad fija. Para más fiabilidad pon `POLLINATIONS_API_KEY` (gratis) y/o `GEMINI_API_KEY`. `AI_PROVIDER=openai` sigue disponible si algún día quieres calidad de pago.

## Planes y límites
Se definen en `shared/plans.ts` (cómics, viñetas por cómic y cuotas mensuales de imágenes/guiones/voces/videos).
Los precios mostrados ahí son solo informativos: **el cobro real es el del Price que crees en Stripe; deben coincidir.**

## Arrancar en tu computadora
```bash
npm install
cp .env.example .env        # y rellénalo
createdb comicdb            # o usa cualquier PostgreSQL y pon su DATABASE_URL
npm run dev                 # http://localhost:5000  (las migraciones se aplican solas)
```
La IA funciona sin ninguna clave (ver «IA gratuita»). Sin claves de Stripe la app funciona, pero muestra "Pagos no disponibles".

## Configurar Stripe (paso a paso)
1. En el Dashboard de Stripe → **Product catalog** crea los productos **Pro** y **Premium**, cada uno con un precio
   **recurrente mensual** (y opcionalmente anual). Copia cada `price_...` en `.env`.
2. **Developers → API keys**: copia la Secret key en `STRIPE_SECRET_KEY` (usa claves `test` primero).
3. **Developers → Webhooks → Add endpoint**: URL `https://TU_DOMINIO/api/billing/webhook` con los eventos
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted` e `invoice.payment_failed`. Copia el *Signing secret* en `STRIPE_WEBHOOK_SECRET`.
   - En local: `stripe listen --forward-to localhost:5000/api/billing/webhook` (CLI de Stripe) te da un `whsec_` temporal.
4. **Settings → Billing → Customer portal**: actívalo (permitir cancelar, cambiar plan y actualizar método de pago).
   El botón «Administrar suscripción» de la app abre ese portal.
5. Prueba con la tarjeta `4242 4242 4242 4242` (cualquier fecha futura y CVC). Cuando todo funcione, cambia a claves `live`
   y vuelve a crear webhook y precios en modo producción.

Qué hace la app: Checkout hospedado por Stripe → el webhook activa el plan → al cancelar o fallar el pago de forma definitiva
vuelve a Gratis. Tus cómics nunca se borran por bajar de plan (solo se bloquea crear más allá del límite).

## Desplegar
Cualquier host con Node 22 + PostgreSQL. Incluye `Dockerfile` (ya trae ffmpeg del sistema y fuentes; sin Docker instala `ffmpeg` y pon `FFMPEG_PATH`, porque el de npm no puede dibujar subtítulos).
- Variables: las de `.env.example`. `APP_URL` debe ser la URL pública exacta con `https://`.
- **Disco persistente** para `UPLOAD_DIR` (imágenes, audios y videos se guardan ahí). Sin disco persistente se pierden al reiniciar.
- Build/arranque sin Docker: `npm ci && npm run build && npm start`.

## Pruebas
`npm run check` (tipos) y `npm test` (prueba de extremo a extremo del backend contra PostgreSQL: cuentas, límites, subidas,
anti-SSRF, webhook firmado de Stripe y render real de video).

## Cuenta
Registro, entrada, recuperación de contraseña por correo (con `SMTP_URL`), cambio de contraseña y **borrado de cuenta** (cancela la suscripción en Stripe y elimina datos y archivos; requisito de App Store).

## Seguridad incluida
Contraseñas con scrypt · sesiones en PostgreSQL con cookie httpOnly · límites de intentos en login y de uso en IA ·
validación de imágenes por firma real (no por extensión) · descarga por URL con bloqueo de redes internas (anti-SSRF) ·
webhooks Stripe con firma e idempotencia · cabeceras de seguridad (helmet/CSP) · cada usuario solo ve sus datos.

## Limitaciones conocidas
- El video es un "motion comic": viñetas con zoom suave, subtítulos y tu narración. No genera animación con IA (eso requiere un proveedor de video externo).
- Almacenamiento en disco local; para escalar a varios servidores conviene migrar a S3/R2.
- Sin verificación del correo al registrarse. La recuperación de contraseña por correo requiere configurar `SMTP_URL`.

## App de Android y iOS (Capacitor)
La misma app web se empaqueta como app nativa; el servidor es el mismo (cuentas, biblioteca, IA, videos).
1. El servidor debe estar publicado con **https** (ver «Desplegar»). Opcional: `CORS_ORIGINS` con orígenes extra separados por coma.
2. `cp .env.mobile.example .env.mobile` y pon en `VITE_API_URL` la URL pública de tu servidor.
3. Cambia `appId` en `capacitor.config.ts` (ej. `com.tuempresa.panelforge`) **antes** de publicar.
4. `npm run mobile:sync` (compila y copia a `android/` e `ios/`). Cada vez que cambies el front, repítelo.
5. **Android:** `npm run mobile:android` (abre Android Studio) → Build → Generate Signed Bundle (.aab) → Google Play Console.
6. **iOS:** requiere una Mac con Xcode: `npm run mobile:ios` → Product → Archive → App Store Connect.
- En la app la sesión usa un token `Bearer` (la web sigue con cookie). Las imágenes/audios/videos se cargan desde `VITE_API_URL`.
- **Pagos:** por defecto la app no muestra botones de compra (Apple/Google tienen reglas propias para suscripciones digitales).
  Mira la sección de pagos antes de activar `VITE_NATIVE_EXTERNAL_CHECKOUT=true`.

## Configuración de producción preparada
Consulta [docs/PRODUCCION.md](docs/PRODUCCION.md). `render.yaml` usa Render Free; Supabase conserva la base de datos y los archivos sin disco persistente de Render. Requiere configurar el proyecto y las credenciales de Supabase antes de desplegar.
