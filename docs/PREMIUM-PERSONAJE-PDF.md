# ComicKlu — Premium con personaje y PDF de pago

## Función Premium

- Los usuarios Gratis y Pro mantienen sus cuotas actuales de guiones, imágenes y viñetas.
- Solo Premium puede subir y vincular una imagen como referencia visual de personaje.
- El servidor verifica la propiedad del archivo y la titularidad del cómic; nunca confía en el plan declarado por el navegador.
- Cada generación con referencia consume una generación ordinaria de imagen, **más** una unidad del cupo de referencia: 20 por mes. Si el proveedor falla, se devuelven ambas unidades.
- La IA recibe realmente la imagen del personaje desde Supabase Storage privado, por medio de OpenAI Images Edit. Se evita prometer consistencia facial perfecta.
- Es necesaria una `OPENAI_API_KEY` válida y saldo/acceso al modelo `CHARACTER_IMAGE_MODEL` (por defecto `gpt-image-2.5-flare`). Ninguna clave se incluye en el repositorio.

## PDF con compra individual

- Cualquier usuario autenticado puede leer la historieta completa en la vista previa.
- El PDF es una compra independiente por cada historieta, sin consumo de créditos y sin plan adicional. El precio **no se fija en código**: se configura con `PDF_EXPORT_PRICE_CENTS` (ejemplo sugerido: `299` para US$2.99).
- Al comprar, Stripe Checkout muestra el importe, acepta el pago y regresa a la misma historieta.
- El webhook firmado **o** la verificación de la sesión pagada por el servidor crea una entrada en `pdf_orders`. Se valida el usuario, el cómic y `payment_status=paid`. Una compra pagada habilita descargas posteriores de esa misma historieta.
- El PDF se compone en el navegador con portada, TODAS las viñetas, narración y diálogos, para no superar el límite de archivos de respuesta de Vercel. Se almacena solo localmente en el dispositivo del comprador.
- La compra se refiere al cómic y sus revisiones futuras del mismo ID; no se aplica a otros cómics del mismo usuario.
- No existe DRM absoluto: cualquier persona que puede ver las páginas también podría imprimirlas o capturarlas. La interfaz oficial restringe la función premium de exportación.

## Requisitos antes de abrir cobros reales

1. Tras identificar PostgreSQL y obtener un respaldo verificable, ejecutar `npm run db:migrate` desde un entorno autorizado y comprobar con `npm run db:verify` que `pdf_orders` existe. **No ejecutar automáticamente migraciones en cada invocación serverless.**
2. En Vercel Production establecer `PDF_EXPORT_PRICE_CENTS`, `STRIPE_WEBHOOK_SECRET`, `APP_URL=https://comicklu.vercel.app` y la clave privada Stripe correspondiente. Las variables `STRIPE_PRICE_*` siguen siendo necesarias para las suscripciones.
3. Configurar el webhook de Stripe a `https://comicklu.vercel.app/api/billing/webhook` con `checkout.session.completed`. Validar firma con raw body y desactivar el endpoint antiguo solo cuando esté confirmado.
4. Usar Stripe TEST en un entorno separado para verificar: pago pagado, cancelado, repetido, otro usuario, otra historieta, webhook duplicado, sesión falsa, historial de descarga.
5. Probar las imágenes del PDF de viñetas largas en escritorio y móvil; verificar que el PDF generado tiene el número de páginas esperado. Un cómic de 200 viñetas podría agotar memoria en dispositivos antiguos.

## Ideas futuras con orden de inversión

**Primeras conversiones:** plantillas de historias, biblioteca de personajes, tutorial de primera historieta, portada IA, lector webtoon vertical, compartir por enlace, galería comunitaria opt-in, editor de diálogos.

**Retención:** series y episodios, personajes reutilizables, historiales/versiones, avisos de nuevos capítulos, favoritos y comentarios moderados.

**Profesional futuro (sin lanzar un nuevo precio hoy):** colaboración en equipo, control de marca, PDF CMYK de imprenta, exportación EPUB, derechos/atribución, bibliotecas de poses, lotes y API. Validar costos reales y demanda antes de crear el cuarto plan.

**Métricas:** visitas→registro, registro→primer cómic, primer cómic→publicación, publicación→suscripción, porcentaje que compra PDF, tasa de repetición del mes, costo unitario por imagen y tasa de fallo de IA.
