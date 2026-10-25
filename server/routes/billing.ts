import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type Stripe from "stripe";
import { db } from "../db";
import { users, stripeEvents } from "@shared/schema";
import { requireAuth, publicUser } from "../auth";
import { env, stripeEnabled } from "../env";
import { getStripe, priceFor, ensureCustomer, applySubscription, syncCustomer } from "../stripe";
import { refreshUser } from "../usage";

export const billingRouter = Router();

const checkoutBody = z.object({
  plan: z.enum(["pro", "premium"]),
  interval: z.enum(["month", "year"]).default("month"),
});

billingRouter.post("/checkout", requireAuth, async (req, res) => {
  const body = checkoutBody.parse(req.body);
  if (!stripeEnabled()) return res.status(503).json({ message: "Los pagos aún no están configurados. Contacta al administrador." });
  const user = req.user!;

  const live = user.subscriptionStatus && ["active", "trialing", "past_due"].includes(user.subscriptionStatus);
  if (live && user.stripeCustomerId) {
    return res.status(409).json({ message: "Ya tienes una suscripción. Usa «Administrar suscripción» para cambiar de plan o cancelar.", usePortal: true });
  }

  const price = priceFor(body.plan, body.interval);
  if (!price) return res.status(503).json({ message: `Falta configurar el precio de ${body.plan} (${body.interval}) en el servidor.` });

  const customer = await ensureCustomer(user);
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    success_url: `${env.appUrl}/account?checkout=success`,
    cancel_url: `${env.appUrl}/precios?checkout=cancelled`,
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
    return_url: `${env.appUrl}/account`,
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
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await applySubscription(event.data.object as Stripe.Subscription);
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
