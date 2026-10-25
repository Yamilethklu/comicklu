# Comicklu: Render gratis + Supabase

## Arquitectura preparada
Render sirve React y Express en comicklu-1, región Ohio, plan free. PostgreSQL y un bucket privado de Supabase conservan usuarios, sesiones, cómics, imágenes, voces y MP4. El disco de Render se usa solo como espacio temporal durante los renders. No crear PostgreSQL de pago ni adjuntar disco en Render.

## Configuración inicial
1. Crear un proyecto Supabase en una organización con plan Free y cupo disponible. Si se cotiza un cargo, detenerse: no contratar recursos de pago.
2. En Render > comicklu-1 > Environment, configurar DATABASE_URL con la conexión Session Pooler de Supabase (puerto 5432, agregar sslmode=require), SUPABASE_URL y SUPABASE_SECRET_KEY (clave secreta solo servidor; service_role también es compatible).
3. Establecer SESSION_SECRET aleatoria, APP_URL=https://comicklu-1.onrender.com, SUPABASE_STORAGE_BUCKET=comicklu-media, UPLOAD_DIR=/tmp/comicklu-uploads y FFMPEG_PATH=/usr/bin/ffmpeg.
4. Crear el bucket privado comicklu-media mediante Storage API o Dashboard, con límite de 50 MB y tipos image/png, image/jpeg, image/gif, image/webp, audio/mpeg, audio/wav y video/mp4. No dar permisos a anon/authenticated: Express usa la clave secreta exclusivamente en el servidor.
5. Desplegar. Las migraciones se aplican al arrancar usando el usuario postgres del proyecto. Las tablas de la aplicación y sesiones quedan con RLS activado y sin acceso para anon/authenticated; el acceso de los usuarios se controla en Express.
6. Revisar /api/health, registro, login, subida, reinicio, recuperación de archivo y render MP4.

## Archivos
Se mantienen las URLs /media/UUID.ext. El bucket es privado; Express transmite los archivos con URLs firmadas internas que expiran en 60 segundos. Como en la versión original, conocer la URL UUID completa permite descargar ese archivo, incluso en la app móvil. No compartir URLs si el contenido es privado. Las entradas de video se descargan a un directorio temporal que se elimina al terminar. El borrado de cuenta elimina los objetos de Storage antes de borrar los registros.

## Stripe pendiente
Configurar en la cuenta comercial elegida: STRIPE_SECRET_KEY (preferiblemente una clave restringida con los permisos necesarios), STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO_MONTHLY y STRIPE_PRICE_PREMIUM_MONTHLY. Opcionales: STRIPE_PRICE_PRO_YEARLY y STRIPE_PRICE_PREMIUM_YEARLY.
Crear el webhook https://comicklu-1.onrender.com/api/billing/webhook con checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted e invoice.payment_failed. Activar Customer Portal.
Los importes visibles son Pro 9.99/mes y 99/año; Premium 24.99/mes y 249/año. Confirmar moneda antes de crear precios. No reutilizar otra cuenta comercial si se pidió una nueva. Crear/verificar una cuenta comercial y proporcionar datos bancarios requiere al titular.

## IA y correo
Configurar POLLINATIONS_API_KEY o los proveedores alternativos de .env.example y probar llamadas reales. Para recuperación de contraseña: SMTP_URL y MAIL_FROM. ADMIN_EMAILS se configura antes de registrar la cuenta administradora.

## Límites y validación
Render gratis puede suspenderse por inactividad; no es un servicio de disponibilidad garantizada. Un reinicio interrumpe videos en proceso. Supabase Free tiene cuotas: revisar almacenamiento y transferencia antes de abrir al público; no se prometen generación ni almacenamiento ilimitados. La aplicación limita cada archivo a 50 MB. Mantener una sola instancia por la cola de video local.
La compilación y las pruebas simuladas no validan Stripe real, SMTP ni disponibilidad de IA externa. No declarar producción completa hasta probar credenciales reales y persistencia tras reinicio. Las apps iOS/Android necesitan publicación separada.
