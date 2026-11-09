# Stripe en producción

La API de Stripe debe quedar en el mismo origen de Vercel: `https://comicklu.vercel.app/api/billing/webhook`. No usar el antiguo endpoint de Render.

1. En Stripe, crear productos y precios recurrentes de Pro y Premium en modo test y configurarlos en `STRIPE_PRICE_PRO_MONTHLY` y `STRIPE_PRICE_PREMIUM_MONTHLY`. Añadir los precios anuales solo si se ofrecerán.
2. Configurar `STRIPE_SECRET_KEY` de test y `STRIPE_WEBHOOK_SECRET` con el secreto del endpoint del modo test.
3. Suscribir el endpoint a `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` e `invoice.payment_failed`.
4. Habilitar Customer Portal y configurar `STRIPE_PORTAL_CONFIGURATION_ID`.
5. Verificar checkout, webhook firmado, activación y cancelación de suscripción con cuentas de prueba antes de usar claves live.

No mezclar claves live con precios test. Mantener vacías las variables de Stripe deshabilita las compras. Nunca publicar claves secretas ni aceptar pagos reales hasta completar y validar la configuración en el Dashboard de Stripe.
