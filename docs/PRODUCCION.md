# Puesta en producción de Comicklu

## Arquitectura
Un servicio Docker en Render sirve React y Express en el mismo dominio, con PostgreSQL privado y disco persistente de 10 GB para imágenes, audios y videos. FFmpeg, espeak-ng y fuentes están incluidos. Se mantiene una sola instancia: la cola de video es local y no es apta para varias réplicas.

## Despliegue
1. Conecta Render con GitHub y autoriza Yamilethklu/comicklu.
2. Abre https://dashboard.render.com/select-repo?type=blueprint y selecciona el repositorio y render.yaml.
3. Revisa y acepta los costos del servicio, PostgreSQL y disco. El archivo usa recursos de pago; no se ha contratado nada al guardarlo en GitHub.
4. Render genera SESSION_SECRET y vincula DATABASE_URL automáticamente. La aplicación usa RENDER_EXTERNAL_URL para HTTPS, cookies y enlaces. Las migraciones se aplican al arrancar.
5. Espera estado Live y abre la URL asignada. /api/health debe responder {"ok":true}.
6. Si añades dominio propio, configura APP_URL=https://tu-dominio y redespliega.

## Secretos y configuración manual
Configura estos valores en Render > Environment, nunca en GitHub ni en mensajes:

| Función | Variables |
| --- | --- |
| Administrador | ADMIN_EMAILS (tu correo; configurarlo antes de registrar esa cuenta) |
| Suscripciones | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PREMIUM_MONTHLY |
| Planes anuales opcionales | STRIPE_PRICE_PRO_YEARLY, STRIPE_PRICE_PREMIUM_YEARLY |
| Recuperación de contraseña | SMTP_URL, MAIL_FROM (remitente autorizado por tu proveedor) |
| IA recomendada | POLLINATIONS_API_KEY; opcionalmente GEMINI_API_KEY y HF_TOKEN |
| Alternativa OpenAI | AI_PROVIDER=openai y OPENAI_API_KEY |

La disponibilidad de los proveedores externos de IA no se garantiza. Antes de vender suscripciones, prueba guion, imagen y voz con credenciales reales y revisa los términos y cuotas del proveedor.

## Stripe
Crea productos Pro y Premium. Los precios visibles del código son 9.99/mes y 99/año para Pro; 24.99/mes y 249/año para Premium. Verifica moneda y precios comerciales antes de crear los precios definitivos.
Configura https://TU-DOMINIO/api/billing/webhook para checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted e invoice.payment_failed. Activa Customer Portal. Prueba primero en modo test; luego configura productos, precios, claves y webhook en modo live.

## Comprobación antes de abrir al público
- Registrar dos usuarios y verificar aislamiento, login y persistencia tras reiniciar.
- Crear y editar cómic, subir una imagen y comprobar que sobrevive al reinicio.
- Generar guion e imagen con el proveedor real.
- Probar compra de prueba, cambio/cancelación de plan, voz y MP4 con subtítulos.
- Recuperar contraseña con un correo real.
- Configurar respaldos de PostgreSQL y del disco; probar restauración. Son dos recursos distintos.
- Revisar privacidad, términos, política de reembolsos y contacto con la información real del negocio.

Las pruebas automatizadas usan IA y Stripe simulados; no validan cargos, entrega SMTP ni disponibilidad de IA externa. Las apps iOS/Android requieren firma y publicación separadas y no quedan publicadas con el despliegue web.
