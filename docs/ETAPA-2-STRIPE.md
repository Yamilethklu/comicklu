# Etapa 2: Stripe y suscripciones

- El plan efectivo depende del estado activo, período vigente y precio autorizado. Si vence, la cuenta sigue en modo Gratis.
- Para PDF se valida el pago confirmado, USD, importe original, cliente Stripe y dueño de la historieta.
- El webhook necesita firma Stripe y cuerpo original; cada sesión de PDF se registra una sola vez.
- Pendiente configurar STRIPE_WEBHOOK_SECRET, cuatro STRIPE_PRICE_*, PDF_EXPORT_PRICE_CENTS en Vercel Production.
- Pendiente probar Stripe TEST: pago, renovación, fallo, vencimiento, cancelación, webhook duplicado, sesión ajena y reembolso.
- Pendiente auditar compras de créditos por separado y confirmar la base de datos real antes de habilitar ventas.
- No se han creado cobros reales ni se han cambiado secretos.
