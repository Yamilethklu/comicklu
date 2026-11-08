# Seguridad del panel de administración

El registro público **siempre** asigna `role=user` incluso si el usuario conoce un email de la lista de propietarios. La lista `ADMIN_EMAILS` se define solo en el entorno seguro de producción de Vercel, y el servidor también comprueba `users.role='admin'` antes de dar acceso.

## Alta segura del propietario

1. Registrarse con el correo propio y verificar el acceso a esa cuenta; no se da rol admin automáticamente.
2. El responsable autorizado de la base de datos, después de identificar la cuenta real, asigna `role='admin'` a su fila con una operación SQL parametrizada o controlada en Supabase (sin contraseñas en el repositorio). No elevar automáticamente un email no verificado.
3. Configurar `ADMIN_EMAILS` en Vercel con el mismo correo y volver a desplegar. Nunca mostrar datos de administración por rutas públicas.
4. Confirmar que un usuario normal recibe HTTP 403 en `/api/admin/summary` y `/api/admin/feedback`, y que el propietario puede consultar ambos.
5. Revocar administradores eliminando el correo de `ADMIN_EMAILS` y cambiando su rol en la DB. Guardar registro de estas acciones.

## Cifras financieras

- Los ingresos de suscripciones se consultan desde facturas pagadas de Stripe de los últimos 30 días y se cotejan con los precios propios de ComicKlu y clientes registrados. Si hay más de 100 facturas, se señala resultado parcial; para una escala mayor conviene almacenar un libro contable propio.
- Los pagos PDF se registran con Stripe Checkout por sesión pagada. Son ingresos **brutos** y no representan utilidad neta: no se han descontado comisiones Stripe, reembolsos, costos de IA, infraestructura ni impuestos.
- No confundir planes activos con ingresos reconocidos. Al expirar un periodo o quedar una factura impagada, el servidor aplica el plan Gratis, pero conserva la sesión y la biblioteca.

## Importante antes del lanzamiento

Las migraciones `0005_pdf_orders`, `0006_site_feedback` y `0007_api_tables_rls` **NO** se aplican automáticamente en Vercel Serverless. Deben aplicarse una sola vez con revisión sobre el proyecto real de PostgreSQL, respaldar la base antes y comprobar el historial Drizzle. No ejecutar migraciones ni recrear tablas en cada petición.
