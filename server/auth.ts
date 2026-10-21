import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, type User } from "@shared/schema";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

const KEY_LEN = 64;

/** Formato guardado: `scrypt$<salt hex>$<hash hex>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Datos del usuario que sí se pueden enviar al navegador (nunca el hash). */
export function publicUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    plan: u.plan,
    subscriptionStatus: u.subscriptionStatus,
    currentPeriodEnd: u.currentPeriodEnd ? u.currentPeriodEnd.toISOString() : null,
    cancelAtPeriodEnd: u.cancelAtPeriodEnd,
    hasBilling: !!u.stripeCustomerId,
  };
}

/** Carga el usuario de la sesión (si hay) en `req.user`. */
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const id = req.session?.userId;
    if (id) {
      const [u] = await db.select().from(users).where(eq(users.id, id));
      if (u) req.user = u;
      else delete req.session.userId; // usuario borrado: se limpia la sesión
    }
    next();
  } catch (e) {
    next(e);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return void res.status(401).json({ message: "Inicia sesión para continuar" });
  next();
}
