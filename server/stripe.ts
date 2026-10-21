import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, type User } from "@shared/schema";
import type { PlanId, Interval } from "@shared/plans";
import { env } from "./env";

let client: Stripe | null = null;
export function getStripe(): Stripe {
  if (!env.stripeSecretKey) throw Object.assign(new Error("Stripe no está configurado en el servidor"), { status: 503 });
  return (client ??= new Stripe(env.stripeSecretKey));
}

export function priceFor(plan: Exclude<PlanId, "free">, interval: Interval): string {
  return env.prices[plan][interval];
}

export function planFromPriceId(priceId: string | undefined): Exclude<PlanId, "free"> | null {
  if (!priceId) return null;
  for (const plan of ["pro", "premium"] as const) {
    for (const interval of ["month", "year"] as const) {
      if (env.prices[plan][interval] === priceId) return plan;
    }
  }
  return null;
}

export async function ensureCustomer(user: User): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await getStripe().customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id },
  });
  await db.update(users).set({ stripeCustomerId: customer.id }).where(eq(users.id, user.id));
  return customer.id;
}

const ACTIVE = new Set(["active", "trialing", "past_due"]);

/** Refleja el estado de una suscripción de Stripe en la tabla de usuarios. */
export async function applySubscription(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  let [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));
  if (!user && sub.metadata?.userId) {
    [user] = await db.select().from(users).where(eq(users.id, sub.metadata.userId));
  }
  if (!user) {
    console.warn(`[stripe] suscripción ${sub.id} sin usuario asociado (customer ${customerId})`);
    return;
  }

  const item = sub.items.data[0];
  const plan = planFromPriceId(item?.price?.id) ?? (sub.metadata?.plan as PlanId | undefined) ?? null;
  const live = ACTIVE.has(sub.status);
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000) : null;

  await db.update(users).set({
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    subscriptionStatus: sub.status,
    plan: live && plan ? plan : "free",
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  }).where(eq(users.id, user.id));
}

/** Consulta a Stripe y alinea al usuario (útil al volver del checkout y como respaldo del webhook). */
export async function syncCustomer(user: User): Promise<void> {
  if (!user.stripeCustomerId) return;
  const list = await getStripe().subscriptions.list({ customer: user.stripeCustomerId, status: "all", limit: 10 });
  const best = list.data.find((s) => ACTIVE.has(s.status)) ?? list.data[0];
  if (best) await applySubscription(best);
}
