import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, Pencil } from "lucide-react";
import { api, errMsg, ApiError } from "@/lib/api";
import { mediaUrl } from "@/lib/native";
import { useMe } from "@/lib/hooks";
import { Page, ErrorNote } from "@/components/Layout";
import { STYLES } from "@shared/plans";

interface Row { id: number; title: string; style: keyof typeof STYLES; updatedAt: string; coverUrl: string | null; synopsis: string }

export default function Dashboard() {
  const qc = useQueryClient();
  const [, nav] = useLocation();
  const { me, user } = useMe();
  const [error, setError] = useState<string | null>(null);
  const [limitHit, setLimitHit] = useState(false);
  const list = useQuery({ queryKey: ["comics"], queryFn: () => api<Row[]>("GET", "/api/comics") });

  const create = useMutation({
    mutationFn: () => api<{ id: number }>("POST", "/api/comics", { title: "Cómic sin título" }),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: ["me"] }); nav(`/studio/${c.id}`); },
    onError: (e) => { setError(errMsg(e)); setLimitHit(e instanceof ApiError && e.status === 402); },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api("DELETE", `/api/comics/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["comics"] }); qc.invalidateQueries({ queryKey: ["me"] }); },
    onError: (e) => setError(errMsg(e)),
  });

  const rows = list.data ?? [];
  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="title-comic text-5xl">Mi estudio privado</h1>
          <p className="mt-2 text-sm text-ink/70">Hola, {user?.name.split(" ")[0]} 👋 Tus historias están guardadas en tu espacio personal.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="rounded-md border-2 border-ink bg-mint/30 px-2 py-1">Espacio privado</span>
            <Link href="/account" className="rounded-md border-2 border-ink bg-white px-2 py-1 hover:bg-sun">Mi plan y consumo</Link>
            <Link href="/precios" className="rounded-md border-2 border-ink bg-sun px-2 py-1 hover:bg-pop/30">Ver suscripciones</Link>
          </div>
          {me?.limits && (
            <div className="mt-2 w-64" role="group" aria-label="Cómics usados en tu plan">
              <div className="h-3 overflow-hidden rounded-full border-2 border-ink bg-white">
                <div className={`h-full ${(me.comics ?? 0) >= me.limits.comics ? "bg-pop" : "bg-mint"}`} style={{ width: `${Math.min(100, ((me.comics ?? 0) / me.limits.comics) * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs font-semibold text-ink/70">{me.comics ?? 0} de {me.limits.comics} cómics en tu plan</p>
            </div>
          )}
        </div>
        <button className="btn-pop btn-shine" onClick={() => { setError(null); create.mutate(); }} disabled={create.isPending}>
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Nuevo cómic
        </button>
      </div>
      <div className="mt-4 space-y-2">
        <ErrorNote message={error} />
        {limitHit && <Link href="/precios" className="btn-sun">Ver planes</Link>}
      </div>

      {list.isError && <div className="frame mt-6 p-5" role="alert"><p className="font-bold">No pudimos cargar tus cómics.</p><p className="mt-1 text-sm">{errMsg(list.error)}</p><button className="btn-sun mt-3" onClick={() => list.refetch()}>Reintentar</button></div>}
      {list.isLoading ? (
        <div className="mt-10 grid place-items-center"><Loader2 className="h-7 w-7 animate-spin" aria-label="Cargando" /></div>
      ) : list.isError ? null : rows.length === 0 ? (
        <div className="frame halftone-soft mt-8 border-dashed p-12 text-center">
          <div className="mx-auto grid h-16 w-16 -rotate-6 place-items-center rounded-xl border-[3px] border-ink bg-sun font-display text-4xl shadow-hard">+</div>
          <p className="mt-4 font-display text-4xl tracking-wide">Tu primera página está en blanco</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink/70">Crea un cómic, escribe la historia y empieza a llenar viñetas.</p>
          <button className="btn-pop mt-5" onClick={() => create.mutate()}>Crear mi primer cómic</button>
        </div>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <li key={c.id} className="frame frame-hover group overflow-hidden shadow-hard">
              <Link href={`/studio/${c.id}`} className="block">
                <div className="halftone relative grid aspect-video place-items-center overflow-hidden border-b-[3px] border-ink bg-sun/60">
                  {c.coverUrl ? <img src={mediaUrl(c.coverUrl)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <span className="font-display text-3xl">{STYLES[c.style]?.name ?? "Cómic"}</span>}
                  <span className="absolute right-2 top-2 rounded-md border-2 border-ink bg-white px-2 py-0.5 text-[11px] font-extrabold">{STYLES[c.style]?.name}</span>
                  <span className="absolute bottom-2 right-2 hidden items-center gap-1 rounded-md border-2 border-ink bg-pop px-2 py-1 text-xs font-extrabold text-white group-hover:flex"><Pencil className="h-3 w-3" aria-hidden />Abrir</span>
                </div>
                <div className="p-4">
                  <h2 className="line-clamp-1 text-lg font-extrabold">{c.title}</h2>
                  <p className="line-clamp-2 min-h-10 text-sm text-ink/70">{c.synopsis || "Sin sinopsis todavía."}</p>
                </div>
              </Link>
              <div className="flex items-center justify-between border-t-2 border-ink/10 px-4 py-2 text-xs text-ink/60">
                <span>Editado {new Date(c.updatedAt).toLocaleDateString("es", { dateStyle: "medium" })}</span>
                <button className="rounded p-1.5 hover:bg-pop/15" aria-label={`Eliminar ${c.title}`}
                  onClick={() => { if (confirm(`¿Eliminar «${c.title}»? Esta acción no se puede deshacer.`)) remove.mutate(c.id); }}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
