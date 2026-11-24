import type { Request, Response } from "express";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { db } from "../db";
import { users, notifications } from "../../shared/schema";
import { env, stripeEnabled, mailEnabled } from "../env";
import { syncCustomer } from "../stripe";
import { sendMail } from "../mail";

export async function renewalJob(req: Request, res: Response) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(req.headers.authorization ?? "");
  const expected = Buffer.from("Bearer " + (secret ?? ""));
  if (!secret || secret.length < 32 || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return res.sendStatus(401);
  res.setHeader("Cache-Control", "no-store");
  const deadline = Date.now() + 40000;
  let notices = 0, errors = 0, synced = 0, mailed = 0, scanned = 0;
  let cursor: string | undefined;
  let exhausted = false;
  // Independent persistent email outbox stored in notification metadata.
  // A lease prevents concurrent workers from claiming the same email.
  async function deliverPending(until: number) {
    if (!mailEnabled()) return;
    while (Date.now() < until) {
      const token = randomUUID();
      const claimed = await db.execute(sql`
        UPDATE notifications SET data = data || jsonb_build_object(
          'mailState','sending','mailLease',${token}::text,
          'mailLeaseUntil', extract(epoch from now()) + 300,
          'mailAttempts', coalesce((data->>'mailAttempts')::int,0)+1)
        WHERE id = (
          SELECT id FROM notifications
          WHERE data->>'mailState' IN ('pending','sending')
            AND coalesce((data->>'mailLeaseUntil')::numeric,0) <= extract(epoch from now())
            AND coalesce((data->>'mailNextAttempt')::numeric,0) <= extract(epoch from now())
          ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1
        ) RETURNING id,user_id,title,body,data
      `);
      const item = claimed.rows[0];
      if (!item) break;
      try {
        const [recipient] = await db.select({email: users.email}).from(users).where(eq(users.id, String(item.user_id)));
        if (!recipient) throw new Error("Missing recipient");
        await sendMail(recipient.email, String(item.title), String(item.body));
        await db.update(notifications).set({data: sql`data || '{"mailState":"sent"}'::jsonb`})
          .where(and(eq(notifications.id, Number(item.id)), sql`data->>'mailLease' = ${token}`));
        mailed++;
      } catch (e) {
        errors++;
        await db.update(notifications).set({data: sql`data || jsonb_build_object(
          'mailState','pending','mailLeaseUntil',0,'mailNextAttempt',
          extract(epoch from now()) + least(86400, 300 * power(2, least(8, coalesce((data->>'mailAttempts')::int,1)))) )`})
          .where(and(eq(notifications.id, Number(item.id)), sql`data->>'mailLease' = ${token}`));
        console.error("[renewals] mail failed", e instanceof Error ? e.name : "unknown");
      }
    }
  }
  await deliverPending(Math.min(deadline, Date.now() + 10000));
  if (stripeEnabled()) {
    while (Date.now() < deadline - 5000) {
      const candidates = await db.select().from(users).where(and(
        sql`${users.role} <> 'admin'`,
        sql`${users.stripeSubscriptionId} is not null`,
        sql`${users.currentPeriodEnd} <= now() + interval '7 days'`,
        sql`${users.subscriptionStatus} in ('active','trialing','past_due')`,
        cursor ? gt(users.id, cursor) : undefined
      )).orderBy(asc(users.id)).limit(50);
      if (!candidates.length) { exhausted = true; break; }
      for (const candidate of candidates) {
        if (Date.now() >= deadline - 5000) break;
        cursor = candidate.id;
        scanned++;
        try {
          await syncCustomer(candidate);
          synced++;
          const [u] = await db.select().from(users).where(eq(users.id, candidate.id));
          if (!u?.currentPeriodEnd || !["active","trialing","past_due"].includes(u.subscriptionStatus ?? "")) continue;
          const days = Math.ceil((u.currentPeriodEnd.getTime() - Date.now()) / 86400000);
          if (days < 1 || days > 7) continue;
          const milestone = days <= 1 ? 1 : days <= 3 ? 3 : 7;
          const key = u.stripeSubscriptionId + ":" + u.currentPeriodEnd.toISOString() + ":" + milestone;
          const title = "Tu suscripción ComicKlu vence en " + days + " día(s)";
          const body = (u.cancelAtPeriodEnd ? "Tu plan termina pronto. Puedes renovarlo desde tu cuenta." : "Revisa tu método de pago para mantener tu plan activo.") + " " + env.appUrl + "/account";
          const created = await db.transaction(async tx => {
            await tx.select({id: users.id}).from(users).where(eq(users.id,u.id)).for("update");
            const [prior] = await tx.select({id: notifications.id}).from(notifications).where(and(eq(notifications.userId,u.id),sql`${notifications.data}->>'renewalKey' = ${key}`)).limit(1);
            if (prior) return false;
            await tx.insert(notifications).values({userId:u.id,type:"system",title,body,data:{renewalKey:key,mailState:"pending",mailAttempts:0}});
            return true;
          });
          if (created) notices++;
        } catch (e) {
          errors++;
          console.error("[renewals] processing failed", e instanceof Error ? e.name : "unknown");
        }
      }
    }
  }
  await deliverPending(deadline);
  return res.status(errors ? 503 : 200).json({synced,notices,errors,mailed,scanned,exhausted,mailConfigured:mailEnabled(),stripeConfigured:stripeEnabled()});
}
