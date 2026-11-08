import { Router } from "express";
import { and, asc, desc, eq, count, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { users, comics, comicLikes, comicComments, userFollowers, referrals } from "@shared/schema";
import { requireAuth, publicUser } from "../auth";
import { httpError } from "../ssrf";
import { PLANS } from "@shared/plans";
import { createNotification } from "./notifications";

export const socialRouter = Router();

/** Listar cómics públicos (galería). Query: ?style=&search=&limit= */
socialRouter.get("/comics/public", async (req, res) => {
  const { search, style, limit = "20", offset = "0" } = z.object({
    search: z.string().optional(),
    style: z.string().optional(),
    limit: z.string().default("20"),
    offset: z.string().default("0"),
  }).parse(req.query);

  const conditions: any[] = [eq(comics.isPublic, true)];
  if (search) conditions.push(or(ilike(comics.title, `%${search}%`), ilike(comics.synopsis, `%${search}%`)));
  if (style) conditions.push(eq(comics.style, style));

  const rows = await db.select({
    id: comics.id, title: comics.title, synopsis: comics.synopsis, style: comics.style,
    coverUrl: comics.coverUrl, createdAt: comics.createdAt, publishedAt: comics.publishedAt,
    userId: comics.userId,
  })
    .from(comics)
    .where(and(...conditions))
    .orderBy(desc(comics.createdAt))
    .limit(Number(limit))
    .offset(Number(offset));

  const enriched = await Promise.all(rows.map(async (c) => {
    const [author] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, c.userId));
    const [{ count: likeCount }] = await db.select({ count: count() }).from(comicLikes).where(eq(comicLikes.comicId, c.id));
    const [myLike] = req.user ? await db.select().from(comicLikes).where(and(eq(comicLikes.comicId, c.id), eq(comicLikes.userId, req.user.id))) : [];
    return { ...c, author: { id: author!.id, name: author!.name }, likeCount: Number(likeCount), likedByMe: !!myLike };
  }));
  res.json(enriched);
});

socialRouter.use(requireAuth);

/** Marcar/desmarcar un cómic como público (solo el autor). */
socialRouter.post("/comics/:id/toggle-public", async (req, res) => {
  const id = Number(req.params.id);
  const [c] = await db.select().from(comics).where(and(eq(comics.id, id), eq(comics.userId, req.user!.id)));
  if (!c) throw httpError(404, "Cómic no encontrado");
  const updated = await db.update(comics).set({
    isPublic: !c.isPublic,
    publishedAt: !c.isPublic ? new Date() : c.publishedAt,
  }).where(eq(comics.id, id)).returning();
  res.json({ isPublic: updated[0].isPublic, publishedAt: updated[0].publishedAt });
});

/** Toggle like en un cómic público. */
socialRouter.post("/comics/:id/like", async (req, res) => {
  const comicId = Number(req.params.id);
  const [c] = await db.select().from(comics).where(and(eq(comics.id, comicId), eq(comics.isPublic, true)));
  if (!c) throw httpError(404, "Cómic público no encontrado");
  const existing = await db.select().from(comicLikes).where(and(eq(comicLikes.comicId, comicId), eq(comicLikes.userId, req.user!.id)));
  if (existing.length) {
    await db.delete(comicLikes).where(and(eq(comicLikes.comicId, comicId), eq(comicLikes.userId, req.user!.id)));
    res.json({ liked: false });
  } else {
    await db.insert(comicLikes).values({ comicId, userId: req.user!.id });
    res.json({ liked: true });
    if (c.userId !== req.user!.id) {
      await createNotification(c.userId, "like", "Nuevo like en tu cómic", `${req.user!.name} le dio like a "${c.title}"`, { comicId }).catch(() => {});
    }
  }
});

/** Listar comentarios de un cómic público. */
socialRouter.get("/comics/:id/comments", async (req, res) => {
  const comicId = Number(req.params.id);
  const rows = await db.select({
    id: comicComments.id, content: comicComments.content, createdAt: comicComments.createdAt,
    userId: comicComments.userId,
  }).from(comicComments).where(eq(comicComments.comicId, comicId)).orderBy(desc(comicComments.createdAt));
  const enriched = await Promise.all(rows.map(async (cm) => {
    const [u] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, cm.userId));
    return { ...cm, author: u ? { id: u.id, name: u.name } : null };
  }));
  res.json(enriched);
});

/** Agregar comentario a un cómic público. */
socialRouter.post("/comics/:id/comments", async (req, res) => {
  const comicId = Number(req.params.id);
  const [c] = await db.select().from(comics).where(and(eq(comics.id, comicId), eq(comics.isPublic, true)));
  if (!c) throw httpError(404, "Cómic público no encontrado");
  const { content } = z.object({ content: z.string().trim().min(1).max(500) }).parse(req.body);
  const [cm] = await db.insert(comicComments).values({ comicId, userId: req.user!.id, content }).returning();
  if (c.userId !== req.user!.id) {
    await createNotification(c.userId, "comment", "Nuevo comentario en tu cómic", `${req.user!.name} comentó en "${c.title}"`, { comicId, commentId: cm.id }).catch(() => {});
  }
  res.status(201).json(cm);
});

/** Perfil público de creador. */
socialRouter.get("/creador/:userId", async (req, res) => {
  const { userId } = z.object({ userId: z.string() }).parse(req.params);
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) throw httpError(404, "Usuario no encontrado");
  const rows = await db.select({
    id: comics.id, title: comics.title, synopsis: comics.synopsis, style: comics.style,
    coverUrl: comics.coverUrl, createdAt: comics.createdAt, publishedAt: comics.publishedAt,
  }).from(comics).where(and(eq(comics.userId, userId), eq(comics.isPublic, true))).orderBy(desc(comics.publishedAt ?? comics.createdAt));
  const [[{ count: followerCount }], [{ count: followingCount }]] = await Promise.all([
    db.select({ count: count() }).from(userFollowers).where(eq(userFollowers.followingId, userId)),
    db.select({ count: count() }).from(userFollowers).where(eq(userFollowers.followerId, userId)),
  ]);
  const [myFollow] = await db.select().from(userFollowers).where(and(eq(userFollowers.followingId, userId), eq(userFollowers.followerId, req.user!.id)));
  res.json({
    author: { id: u.id, name: u.name, email: u.email },
    comics: rows,
    followerCount: Number(followerCount),
    followingCount: Number(followingCount),
    followingByMe: !!myFollow,
  });
});

/** Seguir / dejar de seguir a un creador. */
socialRouter.post("/creador/:userId/follow", async (req, res) => {
  const { userId } = z.object({ userId: z.string() }).parse(req.params);
  if (userId === req.user!.id) throw httpError(400, "No puedes seguirte a ti mismo");
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) throw httpError(404, "Usuario no encontrado");
  const existing = await db.select().from(userFollowers).where(and(eq(userFollowers.followingId, userId), eq(userFollowers.followerId, req.user!.id)));
  if (existing.length) {
    await db.delete(userFollowers).where(and(eq(userFollowers.followingId, userId), eq(userFollowers.followerId, req.user!.id)));
    res.json({ following: false });
  } else {
    await db.insert(userFollowers).values({ followerId: req.user!.id, followingId: userId });
    res.json({ following: true });
    if (userId !== req.user!.id) {
      await createNotification(userId, "follow", "Nuevo seguidor", `${req.user!.name} ahora te sigue en Panelforge`, { followingId: req.user!.id }).catch(() => {});
    }
  }
});

/** Remix (fork) de un cómic público a tu propia biblioteca. */
socialRouter.post("/comics/:id/remix", async (req, res) => {
  const comicId = Number(req.params.id);
  const [c] = await db.select().from(comics).where(and(eq(comics.id, comicId), eq(comics.isPublic, true)));
  if (!c) throw httpError(404, "Cómic público no encontrado");
  const currentCount = await db.select({ n: count() }).from(comics).where(eq(comics.userId, req.user!.id));
  if (Number((currentCount[0] as any).n) >= PLANS.free.limits.comics) {
    return res.status(402).json({ message: "Límite de cómics alcanzado para tu plan." });
  }
  const { panels } = await import("@shared/schema");
  const panelRows = await db.select().from(panels).where(eq(panels.comicId, comicId)).orderBy(asc(panels.position));
  const [nuevo] = await db.insert(comics).values({
    userId: req.user!.id,
    title: `Remix de ${c.title}`,
    synopsis: c.synopsis,
    story: c.story,
    style: c.style,
    settings: c.settings,
    coverUrl: c.coverUrl,
    isPublic: false,
  }).returning();
  if (panelRows.length) {
    await db.insert(panels).values(panelRows.map((p, i) => ({
      comicId: nuevo.id, position: i, imageUrl: p.imageUrl, caption: p.caption,
      dialogue: p.dialogue, prompt: p.prompt, voiceUrl: p.voiceUrl,
    })));
  }
  res.status(201).json({ id: nuevo.id });
});

/** Obtener código de referido del usuario (crear si no existe). */
socialRouter.get("/referrals/me", async (req, res) => {
  let [r] = await db.select().from(referrals).where(eq(referrals.ownerId, req.user!.id));
  if (!r) {
    const code = `PF-${req.user!.id.slice(0, 6)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    [r] = await db.insert(referrals).values({ code, ownerId: req.user!.id }).returning();
  }
  res.json({ code: r.code });
});

/** Canjear un código de referido (valida que exista y no sea propio). */
socialRouter.post("/referrals/claim", async (req, res) => {
  const { code } = z.object({ code: z.string().min(3) }).parse(req.body);
  const [r] = await db.select().from(referrals).where(eq(referrals.code, code.toUpperCase()));
  if (!r) throw httpError(404, "Código de referido no válido");
  if (r.ownerId === req.user!.id) throw httpError(400, "No puedes usar tu propio código");
  res.json({ valid: true, ownerId: r.ownerId });
});