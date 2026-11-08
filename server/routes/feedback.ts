import { Router } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { db } from "../db";
import { comics, pdfOrders, siteFeedback, users } from "@shared/schema";
import { env, stripeEnabled } from "../env";
import { getStripe } from "../stripe";
import { effectivePlan } from "../usage";
import { requireAuth } from "../auth";

export const feedbackRouter = Router();
feedbackRouter.get("/", async (_req, res) => {
  const rows = await db.select({
    id: siteFeedback.id, rating: siteFeedback.rating, comment: siteFeedback.comment,
    adminReply: siteFeedback.adminReply, createdAt: siteFeedback.createdAt,
    author: users.name,
  }).from(siteFeedback).innerJoin(users, eq(siteFeedback.userId, users.id))
    .where(eq(siteFeedback.status, "approved")).orderBy(desc(siteFeedback.createdAt)).limit(40);
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json(rows);
});
feedbackRouter.post("/", requireAuth,
  rateLimit({ windowMs: 60 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: false,
    keyGenerator: req => req.user!.id, validate: { keyGeneratorIpFallback: false },
    message: { message: "Has enviado varios comentarios. Inténtalo más tarde." } }),
  async (req, res) => {
    const body = z.object({ rating: z.number().int().min(1).max(5),
      comment: z.string().trim().min(12).max(1500) }).parse(req.body);
    const [entry] = await db.insert(siteFeedback).values({ ...body, userId: req.user!.id }).returning({ id: siteFeedback.id });
    res.status(201).json({ id: entry.id, message: "Gracias. Revisaremos tu opinión antes de publicarla." });
  },
);

export const adminRouter = Router();
// Protección por duplicado: rol persistido + lista del propietario en el servidor.
export function requireOwner(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  if (!req.user || req.user.role !== "admin" || !env.adminEmails.includes(req.user.email.toLowerCase()))
    return void res.status(403).json({ message: "Acceso reservado a administración." });
  next();
}
adminRouter.use(requireAuth, requireOwner);
adminRouter.get("/summary", async (_req, res) => {
  const monthAgo = new Date(Date.now() - 30 * 24 * 3600_000);
  const [people, comicsTotal, pdfGross, latest, feedback] = await Promise.all([
    db.select({
      id: users.id, plan: users.plan, subscriptionStatus: users.subscriptionStatus,
      currentPeriodEnd: users.currentPeriodEnd, stripeCustomerId: users.stripeCustomerId,
      createdAt: users.createdAt,
    }).from(users),
    db.select({ n: sql<number>`count(*)::int` }).from(comics),
    db.select({ total: sql<number>`coalesce(sum(${pdfOrders.amountCents}),0)::int`, n: sql<number>`count(*)::int` }).from(pdfOrders),
    db.select({ id: users.id, email: users.email, name: users.name, plan: users.plan, status: users.subscriptionStatus, periodEnd: users.currentPeriodEnd, joined: users.createdAt })
      .from(users).orderBy(desc(users.createdAt)).limit(75),
    db.select({ n: sql<number>`count(*)::int` }).from(siteFeedback).where(eq(siteFeedback.status, "pending")),
  ]);
  const plans = { free: 0, pro: 0, premium: 0 };
  for (const p of people) plans[effectivePlan(p)]++;
  const activeCustomers = new Set(people.filter(p=>p.stripeCustomerId).map(p=>p.stripeCustomerId!));
  const prices = new Set([env.prices.pro.month, env.prices.pro.year, env.prices.premium.month, env.prices.premium.year].filter(Boolean));
  let paidInvoicesCents: number | null = null;
  let invoicePartial = false;
  let invoicesRead = 0;
  if (stripeEnabled()) {
    try {
      let total = 0;
      const invoicePages = getStripe().invoices.list({
        limit: 100, created: { gte: Math.floor(monthAgo.getTime() / 1000) },
      });
      for await (const invoice of invoicePages) {
        invoicesRead++;
        if (invoicesRead > 1000) { invoicePartial = true; break; }
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId || !activeCustomers.has(customerId) || invoice.status !== "paid") continue;
        const invoiceLines = invoice.lines.data as unknown as Array<{ price?: { id?: string }, pricing?: { price_details?: { price?: string } } }>;
        if (invoiceLines.some(line => prices.has(line.price?.id ?? line.pricing?.price_details?.price ?? ""))) {
          total += invoice.amount_paid || 0;
        }
      }
      paidInvoicesCents = total;

    } catch (error) {
      paidInvoicesCents = null;
      console.warn("[admin] No se pudieron obtener ingresos de Stripe:", (error as Error).message);
    }
  }
  res.setHeader("Cache-Control", "private, no-store");
  res.json({
    registered: people.length, newUsers30d: people.filter(p=>p.createdAt>=monthAgo).length,
    plans, comics: comicsTotal[0]?.n ?? 0, pdfSales: pdfGross[0]?.n ?? 0,
    pdfGrossCents: pdfGross[0]?.total ?? 0,
    subscriptionGross30dCents: paidInvoicesCents, invoicesTruncated: invoicePartial,
    pendingFeedback: feedback[0]?.n ?? 0,
    recentUsers: latest.map(u=>({...u, effectivePlan: effectivePlan(people.find(p=>p.id===u.id)!)})),
  });
});
adminRouter.get("/feedback", async (_req, res) => {
  const rows = await db.select({ id: siteFeedback.id, rating: siteFeedback.rating, comment: siteFeedback.comment,
    status: siteFeedback.status, adminReply: siteFeedback.adminReply, createdAt: siteFeedback.createdAt,
    name: users.name }).from(siteFeedback).innerJoin(users, eq(siteFeedback.userId, users.id))
    .orderBy(desc(siteFeedback.createdAt)).limit(100);
  res.setHeader("Cache-Control", "private, no-store");
  res.json(rows);
});
adminRouter.patch("/feedback/:id", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const body = z.object({ status: z.enum(["approved","rejected"]), adminReply: z.string().trim().max(1000).optional() }).parse(req.body);
  const [updated] = await db.update(siteFeedback).set({ ...body, updatedAt: new Date() })
    .where(eq(siteFeedback.id,id)).returning({id:siteFeedback.id});
  if (!updated) return res.status(404).json({message:"Comentario no encontrado"});
  res.json({ok:true});
});
