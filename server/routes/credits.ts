import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { users, userCredits, creditTransactions } from "../../shared/schema";
import { requireAuth } from "../auth";
import { getStripe } from "../stripe";
import { env, stripeEnabled } from "../env";
import { httpError } from "../ssrf";
import { eq, and, sql, desc } from "drizzle-orm";

export const creditsRouter = Router();
creditsRouter.use(requireAuth);

const PACKAGES: { id: string; label: string; credits: number; priceCents: number }[] = [
  { id: "small", label: "Paquete pequeño", credits: 100, priceCents: 499 },
  { id: "medium", label: "Paquete mediano", credits: 300, priceCents: 1299 },
  { id: "large", label: "Paquete grande", credits: 700, priceCents: 2799 },
];

/** Ver saldo de créditos del usuario. */
creditsRouter.get("/balance", async (req, res) => {
  const [uc] = await db.select().from(userCredits).where(eq(userCredits.userId, req.user!.id));
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ balance: uc?.balance ?? 0 });
});

/** Listar paquetes de créditos disponibles. */
creditsRouter.get("/packages", (_req, res) => {
  res.json(PACKAGES);
});

/** Crear checkout de pago único para comprar créditos (Stripe payment mode). */
creditsRouter.post("/purchase", async (req, res) => {
  const { packageId } = z.object({ packageId: z.string() }).parse(req.body);
  const pkg = PACKAGES.find((p) => p.id === packageId);
  if (!pkg) throw httpError(400, "Paquete de créditos no válido");

  if (!stripeEnabled() || !env.stripeWebhookSecret) throw httpError(503, "Los pagos de créditos aún no están configurados.");
  const user = req.user!;
  // Asegurar customer de Stripe
  const { ensureCustomer } = await import("../stripe");
  const customer = await ensureCustomer(user);

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer,
    client_reference_id: user.id,
    line_items: [{ price_data: {
      currency: "usd",
      product_data: { name: `KluCredits ComicKlu — ${pkg.label} (${pkg.credits} créditos)` },
      unit_amount: pkg.priceCents,
    }, quantity: 1 }],
    success_url: `${env.appUrl}/account?credits=success`,
    cancel_url: `${env.appUrl}/account?credits=cancelled`,
    metadata: { kind: "comic_credits", userId: user.id, credits: String(pkg.credits), packageId: pkg.id },
  });
  res.json({ url: session.url });
});

/** Registrar exclusivamente pagos de paquetes propios, con bloqueo transaccional por usuario. */
export async function recordCreditPayment(session: import("stripe").default.Checkout.Session) {
  const meta = session.metadata;
  if (session.mode !== "payment" || session.payment_status !== "paid" || meta?.kind !== "comic_credits") return;
  const pkg = PACKAGES.find(p => p.id === meta.packageId);
  const userId = meta.userId;
  const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!pkg || !userId || session.client_reference_id !== userId || !customer ||
      session.currency !== "usd" || session.amount_total !== pkg.priceCents ||
      session.amount_subtotal !== pkg.priceCents || Number(meta.credits) !== pkg.credits) return;
  await db.transaction(async tx => {
    const [owner] = await tx.select({id: users.id, customer: users.stripeCustomerId}).from(users).where(eq(users.id,userId)).for("update");
    if (!owner || owner.customer !== customer) return;
    const [prior] = await tx.select({id: creditTransactions.id}).from(creditTransactions)
      .where(and(eq(creditTransactions.userId,userId),eq(creditTransactions.type,"purchase"),eq(creditTransactions.reference,session.id))).limit(1);
    if (prior) return;
    await tx.insert(userCredits).values({userId,balance:pkg.credits}).onConflictDoUpdate({
      target:userCredits.userId,set:{balance:sql`${userCredits.balance} + ${pkg.credits}`,updatedAt:new Date()}
    });
    await tx.insert(creditTransactions).values({userId,type:"purchase",amount:pkg.credits,reference:session.id});
  });
}
creditsRouter.get("/history", async (req,res) => {
  const rows = await db.select({id:creditTransactions.id,type:creditTransactions.type,amount:creditTransactions.amount,createdAt:creditTransactions.createdAt})
    .from(creditTransactions).where(eq(creditTransactions.userId,req.user!.id)).orderBy(desc(creditTransactions.createdAt)).limit(100);
  res.setHeader("Cache-Control","private, no-store");
  res.json(rows);
});
