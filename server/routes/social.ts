import { Router } from "express";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { users, comics, panels, comicLikes, comicComments, follows, referrals } from "@shared/schema";
import { requireAuth } from "../auth";
import { comicCount, effectivePlan } from "../usage";
import { PLANS } from "@shared/plans";
import { httpError } from "../ssrf";

export const socialRouter = Router();
const idSchema = z.coerce.number().int().positive();
const handle = (v: unknown) => idSchema.parse(v);
const limit = (v: unknown) => Math.min(30, Math.max(1, Number(v) || 12));
const userId = (v: unknown) => z.string().uuid().parse(v);

async function publicComic(id: number) {
  const [row] = await db.select().from(comics).where(and(eq(comics.id, id), eq(comics.isPublic, true)));
  if (!row) throw httpError(404, "Cómic público no encontrado");
  return row;
}

// Los listados públicos excluyen el texto completo de la historia y prompts privados.
socialRouter.get("/explorar", async (req, res) => {
  const query = z.string().max(120).catch("").parse(req.query.q);
  const style = z.string().max(30).catch("").parse(req.query.style);
  const page = Math.min(100, Math.max(1, Number(req.query.page) || 1));
  const where = and(eq(comics.isPublic, true), query ? ilike(comics.title, `%${query}%`) : undefined, style ? eq(comics.style, style) : undefined);
  const rows = await db.select({
    id: comics.id, title: comics.title, synopsis: comics.synopsis, coverUrl: comics.coverUrl,
    style: comics.style, publishedAt: comics.publishedAt,
    creatorId: users.id, creatorName: users.name,
    likes: sql<number>`(SELECT count(*)::int FROM comic_likes WHERE comic_id = ${comics.id})`,
  }).from(comics).innerJoin(users, eq(comics.userId, users.id))
    .where(where).orderBy(desc(comics.publishedAt), desc(comics.id)).limit(limit(req.query.limit)).offset((page - 1) * limit(req.query.limit));
  res.json(rows);
});

socialRouter.get("/comics/:id", async (req, res) => {
  const comic = await publicComic(handle(req.params.id));
  const [owner] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, comic.userId));
  const pics = await db.select({
    position: panels.position, imageUrl: panels.imageUrl, caption: panels.caption, dialogue: panels.dialogue,
  }).from(panels).where(eq(panels.comicId, comic.id)).orderBy(panels.position);
  const [stats] = await db.select({ likes: sql<number>`count(*)::int` }).from(comicLikes).where(eq(comicLikes.comicId, comic.id));
  res.json({
    id: comic.id, title: comic.title, synopsis: comic.synopsis, coverUrl: comic.coverUrl,
    style: comic.style, publishedAt: comic.publishedAt, creator: owner,
    panels: pics, likes: stats?.likes ?? 0,
  });
});

socialRouter.get("/creador/:userId", async (req, res) => {
  const creatorId = userId(req.params.userId);
  const [creator] = await db.select({ id: users.id, name: users.name, createdAt: users.createdAt })
    .from(users).where(eq(users.id, creatorId));
  if (!creator) throw httpError(404, "Creador no encontrado");
  const published = await db.select({ id: comics.id, title: comics.title, synopsis: comics.synopsis, coverUrl: comics.coverUrl, style: comics.style, publishedAt: comics.publishedAt })
    .from(comics).where(and(eq(comics.userId, creatorId), eq(comics.isPublic, true)))
    .orderBy(desc(comics.publishedAt)).limit(40);
  const [stats] = await db.select({ followers: sql<number>`count(*)::int` }).from(follows).where(eq(follows.followingId, creatorId));
  res.json({ creator, comics: published, followers: stats?.followers ?? 0 });
});

socialRouter.get("/comics/:id/comments", async (req, res) => {
  const id = handle(req.params.id);
  await publicComic(id);
  const rows = await db.select({ id: comicComments.id, text: comicComments.text, createdAt: comicComments.createdAt,
    authorId: users.id, authorName: users.name })
    .from(comicComments).innerJoin(users, eq(comicComments.userId, users.id))
    .where(eq(comicComments.comicId, id)).orderBy(desc(comicComments.createdAt)).limit(100);
  res.json(rows);
});

socialRouter.use(requireAuth);

socialRouter.post("/comics/:id/like", async (req, res) => {
  const id = handle(req.params.id);
  await publicComic(id);
  const removed = await db.delete(comicLikes)
    .where(and(eq(comicLikes.comicId, id), eq(comicLikes.userId, req.user!.id))).returning();
  if (removed.length) return res.json({ liked: false });
  await db.insert(comicLikes).values({ comicId: id, userId: req.user!.id }).onConflictDoNothing();
  res.json({ liked: true });
});

socialRouter.post("/comics/:id/comments", async (req, res) => {
  const id = handle(req.params.id);
  await publicComic(id);
  const { text } = z.object({ text: z.string().trim().min(1).max(1000) }).parse(req.body);
  const [row] = await db.insert(comicComments).values({ comicId: id, userId: req.user!.id, text }).returning();
  res.status(201).json({ id: row.id, text: row.text, createdAt: row.createdAt });
});

socialRouter.delete("/comments/:id", async (req, res) => {
  const id = handle(req.params.id);
  const removed = await db.delete(comicComments)
    .where(and(eq(comicComments.id, id), eq(comicComments.userId, req.user!.id))).returning();
  if (!removed.length) throw httpError(404, "Comentario no encontrado");
  res.status(204).end();
});

socialRouter.post("/creador/:userId/follow", async (req, res) => {
  const target = userId(req.params.userId);
  if (target === req.user!.id) throw httpError(400, "No puedes seguirte a ti mismo");
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.id, target));
  if (!exists) throw httpError(404, "Creador no encontrado");
  const removed = await db.delete(follows).where(and(eq(follows.followerId, req.user!.id), eq(follows.followingId, target))).returning();
  if (removed.length) return res.json({ following: false });
  await db.insert(follows).values({ followerId: req.user!.id, followingId: target }).onConflictDoNothing();
  res.json({ following: true });
});

socialRouter.post("/comics/:id/remix", async (req, res) => {
  const original = await publicComic(handle(req.params.id));
  const plan = PLANS[effectivePlan(req.user!)];
  if ((await comicCount(req.user!.id)) >= plan.limits.comics) throw httpError(402, "Has alcanzado el límite de cómics de tu plan");
  const sourcePanels = await db.select().from(panels).where(eq(panels.comicId, original.id)).orderBy(panels.position);
  const take = sourcePanels.slice(0, plan.limits.panelsPerComic);
  const result = await db.transaction(async tx => {
    const [copy] = await tx.insert(comics).values({
      userId: req.user!.id, title: `Remix: ${original.title}`.slice(0,120),
      synopsis: original.synopsis, story: original.story, style: original.style,
      settings: original.settings, coverUrl: original.coverUrl, isPublic: false,
    }).returning();
    if (take.length) await tx.insert(panels).values(take.map((p, position) => ({
      comicId: copy.id, position, imageUrl: p.imageUrl, caption: p.caption, dialogue: p.dialogue,
      prompt: p.prompt, voiceUrl: p.voiceUrl,
    })));
    return copy;
  });
  res.status(201).json({ id: result.id });
});

// Referidos no otorgan recompensas automáticamente: se evita abuso financiero.
socialRouter.get("/referrals/me", async (req, res) => {
  const [count] = await db.select({ total: sql<number>`count(*)::int` }).from(referrals).where(eq(referrals.referrerId, req.user!.id));
  res.json({ code: req.user!.id, total: count?.total ?? 0 });
});
socialRouter.post("/referrals/claim", async (req, res) => {
  const { code } = z.object({ code: z.string().uuid() }).parse(req.body);
  if (code === req.user!.id) throw httpError(400, "No puedes referirte a ti mismo");
  const [referrer] = await db.select({ id: users.id }).from(users).where(eq(users.id, code));
  if (!referrer) throw httpError(404, "Código de referido no válido");
  const [row] = await db.insert(referrals).values({ referrerId: code, referredId: req.user!.id }).onConflictDoNothing().returning();
  if (!row) throw httpError(409, "Ya has reclamado un código de referido");
  res.status(201).json({ ok: true });
});
