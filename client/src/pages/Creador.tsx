import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { User, Plus, Heart, Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Page, ErrorNote } from "@/components/Layout";
import { SkeletonCard } from "@/components/Skeleton";
import { Link } from "wouter";
import type { CreatorProfile } from "@/lib/types";

export default function Creador() {
  const params = useParams<{ userId: string }>();
  const userId = params?.userId ?? "";
  const { show } = useToast();

  const { data: profile, isLoading, error, refetch } = useQuery<CreatorProfile>({
    queryKey: ["creator-profile", userId],
    enabled: !!userId,
    queryFn: async () => api<CreatorProfile>("GET", `/api/social/creador/${userId}`),
  });

  const [following, setFollowing] = useState<boolean | null>(null);

  const toggleFollow = useCallback(async () => {
    try {
      const { following: nowFollowing } = await api<{ following: boolean }>("POST", `/api/social/creador/${userId}/follow`);
      setFollowing(nowFollowing);
      refetch();
      show({ type: "success", title: nowFollowing ? "Ahora sigues a este creador" : "Has dejado de seguir" });
    } catch (e) {
      show({ type: "error", title: "Error", message: errMsg(e) });
    }
  }, [userId, refetch, show]);

  if (error) return <Page><ErrorNote message={errMsg(error)} /></Page>;
  if (isLoading || !profile) return (
    <Page>
      <div className="mt-10 grid place-items-center"><Loader2 className="h-8 w-8 animate-spin" aria-label="Cargando" /></div>
    </Page>
  );

  return (
    <Page>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="title-comic text-5xl">{profile.author.name}</h1>
          <p className="text-sm text-ink/70">{profile.comics.length} cómic{profile.comics.length !== 1 ? "s" : ""} público{profile.comics.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleFollow}
            disabled={following === null}
            className={`rounded-lg px-4 py-2 text-sm font-bold border-2 border-ink transition ${following ? "bg-pop text-white" : "bg-white hover:bg-sun/50"}`}
          >
            {following === null ? <Loader2 className="h-4 w-4" /> : following ? "Siguiendo" : "Seguir"}
          </button>
          <Link href="/dashboard" className="btn-ghost">Ir a mi estudio</Link>
        </div>
      </div>

      <div className="grid gap-3 text-sm text-ink/60 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border-2 border-ink bg-white p-3 text-center">
          <div className="text-2xl font-extrabold text-ink">{profile.followerCount}</div>
          <div className="text-xs">Seguidores</div>
        </div>
        <div className="rounded-lg border-2 border-ink bg-white p-3 text-center">
          <div className="text-2xl font-extrabold text-ink">{profile.followingCount}</div>
          <div className="text-xs">Siguiendo</div>
        </div>
        <div className="rounded-lg border-2 border-ink bg-white p-3 text-center">
          <div className="text-2xl font-extrabold text-ink">{profile.comics.length}</div>
          <div className="text-xs">Cómics públicos</div>
        </div>
      </div>

      {profile.comics.length === 0 ? (
        <div className="mt-12 frame halftone-soft p-16 text-center">
          <User className="mx-auto h-16 w-16 text-ink/30" aria-hidden />
          <h2 className="mt-4 font-display text-3xl tracking-wide">Sin cómics públicos todavía</h2>
          <p className="mt-2 text-sm text-ink/70">Este creador no ha publicado cómics públicos.</p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {profile.comics.map((c) => (
            <li key={c.id} className="frame frame-hover group overflow-hidden shadow-hard flex flex-col">
              <Link href={`/studio/${c.id}`} className="block relative aspect-video overflow-hidden bg-sun/40">
                {c.coverUrl ? (
                  <img src={c.coverUrl} alt={c.title} className="h-full w-full object-cover group-hover:scale-105 transition duration-300" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center border-[3px] border-ink bg-white/50 font-display text-2xl">{c.style}</div>
                )}
              </Link>
              <div className="p-4">
                <h2 className="line-clamp-1 text-lg font-extrabold group-hover:text-pop">{c.title}</h2>
                <p className="line-clamp-2 mt-1 text-sm text-ink/70">{c.synopsis}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-ink/60">
                  <span>{c.likeCount}</span>
                  <span>•</span>
                  <span>{new Date(c.createdAt).toLocaleDateString("es", { dateStyle: "medium" })}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}