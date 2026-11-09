import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { users, userCredits, creditTransactions } from "../../shared/schema";
import { requireAuth } from "../auth";
import { getStripe } from "../stripe";
import { env } from "../env";
import { httpError } from "../ssrf";
import { eq } from "drizzle-orm";

export const creditsRouter = Router();
creditsRouter.use(requireAuth);

const PACKAGES: { id: string; label: string; credits: number; priceCents: number }[] = [
  { id: "small", label: "Paquete pequeño", credits: 100, priceCents: 499 },
  { id: "medium", label: "Paquete mediano", credits: 300, priceCents: 1299 },
  { id: "large", label: "Paquete grande", credits: 700, priceCents: 2799 },
];

/** Ver saldo de créditos del usuario. */
creditsRouter.get("/balance", async (req, res) => {
  let [uc] = await db.select().from(userCredits).where(eq(userCredits.userId, req.user!.id));
  if (!uc) {
    [uc] = await db.insert(userCredits).values({ userId: req.user!.id, balance: 0 }).returning();
  }
  res.json({ balance: uc.balance });
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

  const user = req.user!;
  let [uc] = await db.select().from(userCredits).where(eq(userCredits.userId, user.id));
  if (!uc) {
    [uc] = await db.insert(userCredits).values({ userId: user.id, balance: 0 }).returning();
  }

  // Asegurar customer de Stripe
  const { ensureCustomer } = await import("../stripe");
  const customer = await ensureCustomer(user);

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer,
    client_reference_id: user.id,
    line_items: [{ price_data: {
      currency: "usd",
      product_data: { name: `Créditos Panelforge — ${pkg.label} (${pkg.credits} créditos)` },
      unit_amount: pkg.priceCents,
    }, quantity: 1 }],
    success_url: `${env.appUrl}/account?credits=success`,
    cancel_url: `${env.appUrl}/account?credits=cancelled`,
    metadata: { userId: user.id, credits: String(pkg.credits), packageId: pkg.id },
  });
  res.json({ url: session.url });
});

/** Añadir créditos tras un pago exitoso (llamado desde webhook o sync). */
async function addCredits(userId: string, amount: number, reference?: string) {
  await db.transaction(async (tx) => {
    let [uc] = await tx.select().from(userCredits).where(eq(userCredits.userId, userId));
    if (!uc) {
      [uc] = await tx.insert(userCredits).values({ userId, balance: amount }).returning();
    } else {
      await tx.update(userCredits).set({ balance: uc.balance + amount, updatedAt: new Date() }).where(eq(userCredits.userId, userId));
    }
    await tx.insert(creditTransactions).values({ userId, type: "purchase", amount, reference });
  });
}

export { addCredits };