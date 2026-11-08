import { Router, type Request, type Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type Stripe from "stripe";
import { db } from "../db";
import { users, stripeEvents, comics, panels, pdfOrders } from "@shared/schema";
import { requireAuth, publicUser } from "../auth";
import { env, stripeEnabled, checkoutEnabled } from "../env";
import { getStripe, priceFor, ensureCustomer, applySubscription, syncCustomer } from "../stripe";
import { refreshUser } from "../usage";
import { addCredits } from "./credits";

export const billingRouter = Router();

/** Registrar un pago PDF firmado por Stripe, sin duplicar derechos de descarga. */
async function recordPdfPayment(s: Stripe.Checkout.Session): Promise<void> {
  if (s.mode !== "payment" || s.payment_status !== "paid" || s.metadata?.kind !== "comic_pdf") return;
  const userId = s.metadata.userId;
  const comicId = Number(s.metadata.comicId);
  if (!userId || !Number.isSafeInteger(comicId) || comicId < 1) return;
  const [comic] = await db.select({ id: comics.id }).from(comics)
    .where(and(eq(comics.id, comicId), eq(comics.userId, userId)));
  if (!comic) return;
  if (!s.amount_total || !Number.isSafeInteger(s.amount_total) || s.amount_total < 50) return;
  await db.insert(pdfOrders).values({
    userId, comicId, stripeSessionId: s.id, amountCents: s.amount_total,
  }).onConflictDoNothing();
}

const pdfComicId = z.coerce.number().int().positive();

/** Precio único, visible antes de cobrar; no tocar las cuotas de generación. */
billingRouter.get("/pdf/config", (_req, res) => {
  const price = Number(process.env.PDF_EXPORT_PRICE_CENTS ?? 0);
  res.json({ available: stripeEnabled() && !!env.stripeWebhookSecret && Number.isSafeInteger(price) && price >= 50,
    priceCents: price >= 50 ? price : null, currency: "usd" });
});

billingRouter.post("/pdf/checkout", requireAuth, async (req, res) => {
  const { comicId } = z.object({ comicId: pdfComicId }).parse(req.body);
  const price = Number(process.env.PDF_EXPORT_PRICE_CENTS ?? 0);
  if (!stripeEnabled() || !env.stripeWebhookSecret || !Number.isSafeInteger(price) || price < 50)
    return res.status(503).json({ message: "La compra de PDF aún no está configurada." });
  const [comic] = await db.select({ id: comics.id, title: comics.title }).from(comics)
    .where(and(eq(comics.id, comicId), eq(comics.userId, req.user!.id)));
  if (!comic) return res.status(404).json({ message: "Historieta no encontrada." });
  const [count] = await db.select({ n: sql<number>`count(*)::int` }).from(panels).where(eq(panels.comicId, comicId));
  if (!count?.n) return res.status(400).json({ message: "Agrega viñetas antes de comprar la descarga." });
  const [paid] = await db.select({ id: pdfOrders.id }).from(pdfOrders)
    .where(and(eq(pdfOrders.comicId, comicId), eq(pdfOrders.userId, req.user!.id))).limit(1);
  if (paid) return res.json({ paid: true });
  const customer = await ensureCustomer(req.user!);
  const checkout = await getStripe().checkout.sessions.create({
    mode: "payment", customer, client_reference_id: req.user!.id,
    line_items: [{ price_data: { currency: "usd", unit_amount: price,
      product_data: { name: "Descarga PDF de historieta", description: comic.title.slice(0, 120) } }, quantity: 1 }],
    success_url: `${env.siteUrl}/studio/${comicId}?pdf_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.siteUrl}/studio/${comicId}?pdf_checkout=cancelled`,
    metadata: { kind: "comic_pdf", userId: req.user!.id, comicId: String(comicId) },
  });
  res.json({ url: checkout.url, paid: false });
});

billingRouter.get("/pdf/status/:comicId", requireAuth, async (req, res) => {
  const comicId = pdfComicId.parse(req.params.comicId);
  const [comic] = await db.select({ id: comics.id }).from(comics)
    .where(and(eq(comics.id, comicId), eq(comics.userId, req.user!.id)));
  if (!comic) return res.status(404).json({ message: "Historieta no encontrada." });
  const checkoutId = z.string().max(300).optional().parse(req.query.session_id);
  if (checkoutId && stripeEnabled()) {
    const s = await getStripe().checkout.sessions.retrieve(checkoutId);
    const customerId = typeof s.customer === "string" ? s.customer : s.customer?.id;
    if (s.metadata?.kind === "comic_pdf" && s.metadata.userId === req.user!.id &&
      Number(s.metadata.comicId) === comicId && customerId === req.user!.stripeCustomerId) {
      await recordPdfPayment(s);
    }
  }
  const [paid] = await db.select({ paidAt: pdfOrders.paidAt }).from(pdfOrders)
    .where(and(eq(pdfOrders.comicId, comicId), eq(pdfOrders.userId, req.user!.id))).limit(1);
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ paid: !!paid, paidAt: paid?.paidAt ?? null });
});


const checkoutBody = z.object({
  plan: z.enum(["pro", "premium"]),
  interval: z.enum(["month", "year"]).default("month"),
});

billingRouter.post("/checkout", requireAuth, async (req, res) => {
  const body = checkoutBody.parse(req.body);
  if (!checkoutEnabled()) return res.status(503).json({ message: "No se pueden iniciar suscripciones hasta que Stripe y el webhook estén configurados correctamente." });
  const user = req.user!;

  const live = user.subscriptionStatus && ["active", "trialing", "past_due"].includes(user.subscriptionStatus);
  if (live && user.stripeCustomerId) {
    return res.status(409).json({ message: "Ya tienes una suscripción. Usa «Administrar suscripción» para cambiar de plan o cancelar.", usePortal: true });
  }

  const price = priceFor(body.plan, body.interval);
  if (!price) return res.status(503).json({ message: `Falta configurar el precio de ${body.plan} (${body.interval}) en el servidor.` });

  const customer = await ensureCustomer(user);
  // Verifica también en Stripe para impedir un segundo Checkout si el webhook va retrasado.
  const existing = await getStripe().subscriptions.list({ customer, status: "all", limit: 50 });
  if (existing.data.some((s) => ["active", "trialing", "past_due", "incomplete", "paused"].includes(s.status))) {
    return res.status(409).json({ message: "Ya tienes una suscripción o un pago pendiente. Revísalo desde «Mi cuenta».", usePortal: true });
  }
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    success_url: `${env.siteUrl}/account?checkout=success`,
    cancel_url: `${env.siteUrl}/precios?checkout=cancelled`,
    subscription_data: { metadata: { userId: user.id, plan: body.plan } },
    metadata: { userId: user.id, plan: body.plan },
  });
  res.json({ url: session.url });
});

billingRouter.post("/portal", requireAuth, async (req, res) => {
  if (!stripeEnabled()) return res.status(503).json({ message: "Los pagos aún no están configurados." });
  const user = req.user!;
  if (!user.stripeCustomerId) return res.status(400).json({ message: "Todavía no tienes una suscripción que administrar." });
  const session = await getStripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${env.siteUrl}/account`,
    ...(env.stripePortalConfigurationId ? { configuration: env.stripePortalConfigurationId } : {}),
  });
  res.json({ url: session.url });
});

/** El front lo llama al volver de Stripe para ver el plan nuevo sin esperar al webhook. */
billingRouter.post("/sync", requireAuth, async (req, res) => {
  if (stripeEnabled()) await syncCustomer(req.user!);
  const fresh = await refreshUser(req.user!.id);
  res.json({ user: publicUser(fresh!) });
});

/** Webhook: se monta con body crudo en index.ts (antes de express.json). */
export async function stripeWebhook(req: Request, res: Response) {
  if (!stripeEnabled() || !env.stripeWebhookSecret) return res.status(503).send("Stripe webhook no configurado");
  const sig = req.headers["stripe-signature"];
  if (typeof sig !== "string") return res.status(400).send("Falta la firma");

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body as Buffer, sig, env.stripeWebhookSecret);
  } catch (err) {
    console.warn("[stripe] firma de webhook inválida:", (err as Error).message);
    return res.status(400).send("Firma inválida");
  }

  const inserted = await db.insert(stripeEvents).values({ id: event.id, type: event.type }).onConflictDoNothing().returning();
  if (inserted.length === 0) return res.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode === "subscription" && s.subscription) {
          const subId = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
          await applySubscription(await getStripe().subscriptions.retrieve(subId));
        }
        if (s.mode === "payment" && s.metadata?.kind === "comic_pdf") {
          await recordPdfPayment(s);
        }
        if (s.mode === "payment" && s.payment_status === "paid" && s.metadata?.credits) {
          await addCredits(typeof s.client_reference_id === "string" ? s.client_reference_id : s.metadata.userId, Number(s.metadata.credits), s.id);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        // Stripe entrega webhooks fuera de orden. Consultar su estado actual evita
        // que un evento antiguo restaure un plan cancelado o reemplace un cambio reciente.
        {
          const sub = event.data.object as Stripe.Subscription;
          const latest = await getStripe().subscriptions.retrieve(sub.id);
          await applySubscription(latest);
        }
        break;
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const cust = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
        console.warn(`[stripe] pago fallido para customer ${cust}`);
        if (cust) {
          const [u] = await db.select().from(users).where(eq(users.stripeCustomerId, cust));
          if (u) await syncCustomer(u);
        }
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    // Si falla, liberamos el evento para que Stripe lo reintente.
    await db.delete(stripeEvents).where(eq(stripeEvents.id, event.id));
    console.error("[stripe] error procesando", event.type, err);
    res.status(500).send("Error procesando el evento");
  }
}
