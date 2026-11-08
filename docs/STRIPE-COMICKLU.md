# Verificación de Stripe — ComicKlu (cuenta tropicaña, modo real)

Auditoría del 7 de noviembre de 2026. **No se crearon productos ni se cobraron pagos.**

| Plan | Precio activo | ID de Price |
| --- | --- | --- |
| Pro mensual | USD 9.99 | `price_1UUJCpLtWhUmAxiC3d4FTyuK` |
| Pro anual | USD 99.00 | `price_1UUJDFLtWhUmAxiCAg9fVEag` |
| Premium mensual | USD 24.99 | `price_1UUJCsLtWhUmAxiCR3kGSulv` |
| Premium anual | USD 249.00 | `price_1UUJDILtWhUmAxiC0mYrE6Xu` |

- Productos activos: `prod_VVJqAiYSbuJk2P` (Pro), `prod_VVJqSuodA1QShu` (Premium).
- Portal activo: `bpc_1UUJDVLtWhUmAxiCESVY3y5s` (cancelación al terminar el período, gestión de pago y actualización de suscripción).
- Webhook activo: `we_1UUJDLLtWhUmAxiCSYdvsnNe`, URL `https://comicklu-1.onrender.com/api/billing/webhook`. Eventos: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
- Suscripciones encontradas: cero en el momento de la auditoría.

## Configurar el backend de producción

En **Render > comicklu-1 > Environment** comprueba las variables `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, los cuatro `STRIPE_PRICE_*`, y `STRIPE_PORTAL_CONFIGURATION_ID`. Los valores públicos de precios y del portal están en `.env.example` como referencia. **No copies ni publiques jamás claves secretas**; las credenciales deben introducirse directamente en el proveedor.

`APP_URL` es el backend; si se publica la interfaz en Vercel, configura `PUBLIC_SITE_URL=https://tu-web.vercel.app` para redirecciones del Checkout, portal y recuperación de contraseña. Mantén el endpoint webhook de Stripe en el backend de Render hasta realizar una migración integral. Si cambias `APP_URL`, no olvides sincronizar el webhook y probar su firma en Stripe.

**Antes de aceptar clientes**: prueba alta de cuenta, login, aislamiento de usuarios, Checkout en test con credenciales test y IDs de prueba, evento webhook firmado, confirmación del plan, portal, cancelación, recuperación de contraseña y aplicación de límites. No mezcles claves live con precios test. No sustituir pruebas reales por configuración verificada.
