import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, Heart, User, Share2, Clock } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Page, ErrorNote } from "@/components/Layout";
import { SkeletonCard } from "@/components/Skeleton";
import { mediaUrl } from "@/lib/native";
import type { PublicComic } from "@/lib/types";
import { STYLES } from "@shared/plans";

export default function Explorar() {
  const [search, setSearch] = useState("");
  const [style, setStyle] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const { show } = useToast();

  const { data: comics = [], isLoading, error, refetch } = useQuery<PublicComic[]>({
    queryKey: ["public-comics", search, style, offset],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (style) params.set("style", style);
      params.set("limit", "20");
      params.set("offset", String(offset));
      return api<PublicComic[]>("GET", `/api/social/comics/public?${params}`);
    },
  });

  const loadMore = useCallback(() => setOffset((o) => o + 20), []);
  const reset = useCallback(() => setOffset(0), []);

  useEffect(() => reset(), [search, style]);

  const styles = Object.entries(STYLES) as [string, { name: string }][];

  if (error) return <Page><ErrorNote message={errMsg(error)} /><button className="btn-pop mt-4" onClick={() => refetch()}>Reintentar</button></Page>;

  return (
    <Page>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="title-comic text-5xl">Explorar</h1>
          <p className="text-sm text-ink/70">Cómics públicos de la comunidad. Dale like, sigue a sus creadores o haz remix.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="field" placeholder="Buscar cómics…"
            value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          />
          <select className="field !w-auto !py-1.5" value={style ?? ""} onChange={(e) => { setStyle(e.target.value || null); setOffset(0); }}>
            <option value="">Todos los estilos</option>
            {styles.map(([k, s]) => <option key={k} value={k}>{s.name}</option>)}
          </select>
          <button className="btn-pop" onClick={() => { setSearch(""); setStyle(null); setOffset(0); }}>
            <Clock className="h-4 w-4 mr-2" aria-hidden />Limpiar
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : comics.length === 0 ? (
        <div className="frame halftone-soft mt-12 p-16 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border-[3px] border-ink bg-sun font-display text-5xl shadow-hard">🔍</div>
          <h2 className="mt-4 font-display text-3xl tracking-wide">No hay cómics todavía</h2>
          <p className="mt-2 text-sm text-ink/70">Sé el primero en publicar un cómic público desde tu estudio.</p>
          <Link href="/dashboard" className="btn-pop mt-6">Ir a mi estudio</Link>
        </div>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {comics.map((c) => (
            <li key={c.id} className="frame frame-hover group overflow-hidden shadow-hard flex flex-col">
              <Link href={`/studio/${c.id}`} className="block relative aspect-video overflow-hidden bg-sun/40">
                {c.coverUrl ? (
                  <img src={mediaUrl(c.coverUrl)} alt={c.title} className="h-full w-full object-cover group-hover:scale-105 transition duration-300" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center border-[3px] border-ink bg-white/50 font-display text-2xl">{STYLES[c.style as keyof typeof STYLES]?.name ?? "Cómic"}</div>
                )}
                <span className="absolute right-2 top-2 rounded-md border-2 border-ink bg-white px-2 py-0.5 text-[11px] font-extrabold">{STYLES[c.style as keyof typeof STYLES]?.name}</span>
              </Link>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Link href={`/creador/${c.author.id}`} className="font-bold text-ink hover:text-pop truncate">{c.author.name}</Link>
                  <button
                    onClick={(e) => { e.preventDefault(); handleToggleLike(c.id, c.likedByMe); }}
                    className={`rounded p-1.5 transition ${c.likedByMe ? "text-pop" : "text-ink/60"}`} aria-label="Me gusta"
                  >
                    <Heart className={`h-5 w-5 ${c.likedByMe ? "fill-pop" : ""}`} />
                  </button>
                </div>
                <h2 className="line-clamp-1 text-lg font-extrabold group-hover:text-pop">{c.title}</h2>
                <p className="line-clamp-2 mt-1 text-sm text-ink/70">{c.synopsis}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-ink/60">
                  <span>{c.likeCount} <Heart className="h-3 w-3 fill-current ml-0.5" /></span>
                  <span>•</span>
                  <span>{new Date(c.createdAt).toLocaleDateString("es", { dateStyle: "medium" })}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {comics.length === 20 && (
        <div className="mt-6 flex justify-center">
          <button className="btn-sun" onClick={loadMore}>Cargar más</button>
        </div>
      )}
    </Page>
  );

  async function handleToggleLike(comicId: number, currentlyLiked: boolean) {
    try {
      const { liked } = await api<{ liked: boolean }>("POST", `/api/social/comics/${comicId}/like`);
      refetch();
      show({ type: "success", title: liked ? "¡Me gusta!" : "Me gusta eliminado" });
    } catch (e) {
      show({ type: "error", title: "Error", message: errMsg(e) });
    }
  }
}
