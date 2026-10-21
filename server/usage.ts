import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { usage, users, comics, type User } from "@shared/schema";
import { PLANS, METRIC_LABEL, type Metric, type PlanId } from "@shared/plans";

export const currentMonth = () => new Date().toISOString().slice(0, 7);

/** Plan efectivo: si la suscripción no está vigente, se aplica Gratis. */
export function effectivePlan(u: User): PlanId {
  if (u.plan === "free") return "free";
  const ok = u.subscriptionStatus === "active" || u.subscriptionStatus === "trialing" || u.subscriptionStatus === "past_due";
  return ok ? (u.plan as PlanId) : "free";
}

export async function getUsage(userId: string) {
  const rows = await db.select().from(usage).where(and(eq(usage.userId, userId), eq(usage.month, currentMonth())));
  const out: Record<Metric, number> = { image: 0, story: 0, voice: 0, video: 0 };
  for (const r of rows) if (r.metric in out) out[r.metric as Metric] = r.count;
  return out;
}

export class LimitError extends Error {
  status = 402;
  constructor(message: string) { super(message); }
}

/**
 * Reserva una unidad de uso de forma atómica. Si supera el límite del plan lanza LimitError.
 * Devuelve una función `refund` para devolver la unidad si la operación externa falla.
 */
export async function consume(user: User, metric: Metric): Promise<() => Promise<void>> {
  const plan = PLANS[effectivePlan(user)];
  const limit = plan.limits.monthly[metric];
  if (limit <= 0) {
    throw new LimitError(`Tu plan ${plan.name} no incluye ${METRIC_LABEL[metric]}. Mejora tu plan para usarlo.`);
  }
  const month = currentMonth();
  const res = await db.execute(sql`
    INSERT INTO usage (user_id, month, metric, count) VALUES (${user.id}, ${month}, ${metric}, 1)
    ON CONFLICT (user_id, month, metric)
    DO UPDATE SET count = usage.count + 1 WHERE usage.count < ${limit}
    RETURNING count`);
  if (res.rows.length === 0) {
    throw new LimitError(`Llegaste al límite mensual de ${METRIC_LABEL[metric]} de tu plan ${plan.name} (${limit}). Mejora tu plan o espera al próximo mes.`);
  }
  return async () => {
    await db.execute(sql`UPDATE usage SET count = GREATEST(count - 1, 0)
      WHERE user_id = ${user.id} AND month = ${month} AND metric = ${metric}`);
  };
}

export async function comicCount(userId: string) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(comics).where(eq(comics.userId, userId));
  return r?.n ?? 0;
}

export async function refreshUser(id: string) {
  const [u] = await db.select().from(users).where(eq(users.id, id));
  return u;
}
