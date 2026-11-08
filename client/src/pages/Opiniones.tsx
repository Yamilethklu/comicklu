import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, Star } from "lucide-react";
import { Page } from "@/components/Layout";
import { api, errMsg } from "@/lib/api";
import { useMe } from "@/lib/hooks";

type Review = { id: number; rating: number; comment: string; adminReply: string | null; author: string; createdAt: string };

export default function Opiniones() {
  const { user } = useMe();
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const reviews = useQuery({ queryKey: ["site-feedback"], queryFn: () => api<Review[]>("GET", "/api/feedback") });
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setSending(true); setMessage("");
    try {
      const res = await api<{message:string}>("POST", "/api/feedback", { rating, comment });
      setMessage(res.message); setComment("");
      void qc.invalidateQueries({ queryKey: ["site-feedback"] });
    } catch (err) { setMessage(errMsg(err)); }
    finally { setSending(false); }
  };
  return <Page>
    <div className="max-w-3xl">
      <h1 className="title-comic text-5xl">Tu opinión mejora ComicKlu</h1>
      <p className="mt-3 text-ink/75">Comparte tu experiencia, sugerencias o cosas que debamos corregir. Revisamos los comentarios antes de publicarlos para mantener un espacio respetuoso.</p>
      <section className="frame mt-8 bg-sun/25 p-6">
        <h2 className="text-xl font-extrabold"><MessageSquare className="mr-2 inline h-5 w-5" />Deja tu comentario</h2>
        {user ? <form className="mt-4 space-y-4" onSubmit={send}>
          <fieldset><legend className="label">Calificación</legend>
            <div className="flex gap-2">{[1,2,3,4,5].map(n=><button key={n} type="button" aria-label={`${n} estrellas`} aria-pressed={rating===n}
              className="rounded-lg border-2 border-ink bg-white p-2" onClick={()=>setRating(n)}>
              <Star className={`h-6 w-6 ${n<=rating?"fill-yellow-400 text-yellow-500":"text-gray-400"}`} />
            </button>)}</div></fieldset>
          <div><label className="label" htmlFor="review-text">Tu experiencia</label>
            <textarea id="review-text" className="field min-h-32" maxLength={1500} minLength={12} required
              placeholder="¿Qué te gustó? ¿Qué mejorarías?" value={comment} onChange={e=>setComment(e.target.value)} /></div>
          <button className="btn-pop" disabled={sending||comment.trim().length<12} type="submit"><Send className="h-4 w-4" />{sending?"Enviando…":"Enviar comentario"}</button>
          {message && <p role="status" className="font-semibold">{message}</p>}
        </form> : <div className="mt-4"><p className="mb-3">Inicia sesión para publicar tu opinión.</p><Link href="/registro" className="btn-pop">Crear cuenta gratis</Link></div>}
      </section>
      <section className="mt-9" aria-label="Opiniones publicadas">
        <h2 className="text-2xl font-extrabold">Lo que dice nuestra comunidad</h2>
        {reviews.isLoading && <p className="mt-4">Cargando comentarios…</p>}
        {reviews.isError && <p role="alert" className="mt-4">No pudimos cargar las opiniones. <button className="underline" onClick={()=>reviews.refetch()}>Reintentar</button></p>}
        {reviews.data?.length===0 && <p className="mt-4">Aún no hay comentarios publicados. ¡Puedes dejar el primero!</p>}
        <div className="mt-4 space-y-4">{reviews.data?.map(review=><article key={review.id} className="frame bg-white p-5">
          <div className="flex items-center justify-between gap-2"><strong>{review.author}</strong><span aria-label={`${review.rating} de 5 estrellas`} className="text-amber-600">{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</span></div>
          <p className="mt-2 whitespace-pre-wrap break-words">{review.comment}</p>
          {review.adminReply && <p className="mt-3 rounded bg-sun/30 p-3 text-sm"><strong>Respuesta de ComicKlu:</strong> {review.adminReply}</p>}
          <time className="mt-2 block text-xs text-ink/60">{new Date(review.createdAt).toLocaleDateString("es-MX")}</time>
        </article>)}</div>
      </section>
    </div>
  </Page>;
}
