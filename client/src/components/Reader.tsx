import { Play } from "lucide-react";
import { mediaUrl } from "@/lib/native";
import type { ComicData } from "@/lib/types";
import { STYLES } from "@shared/plans";

/** Vista previa tipo página de cómic: imagen + narración + globo de diálogo. */
export function Reader({ comic }: { comic: ComicData }) {
  const horizontal = comic.settings.layout === "horizontal";
  const filled = comic.panels.filter((p) => p.imageUrl || p.caption || p.dialogue);
  return (
    <div>
      <div className="frame bg-white p-5 shadow-hard">
        <h2 className="font-display text-4xl tracking-wide">{comic.title || "Sin título"}</h2>
        <p className="mt-1 text-sm font-bold text-pop">{STYLES[comic.style].name}{comic.settings.tone ? ` · ${comic.settings.tone}` : ""}</p>
        {comic.synopsis && <p className="mt-2 max-w-2xl text-sm text-ink/80">{comic.synopsis}</p>}
      </div>
      {filled.length === 0 ? (
        <p className="frame mt-5 p-8 text-center text-sm text-ink/70">Aún no hay viñetas para mostrar. Agrégalas en la pestaña «Viñetas».</p>
      ) : (
        <div className={`mt-5 grid gap-4 ${horizontal ? "sm:grid-cols-2 lg:grid-cols-3" : "mx-auto max-w-xl grid-cols-1"}`}>
          {filled.map((p, i) => (
            <figure key={i} className="frame relative overflow-hidden bg-ink shadow-hard">
              <div className="relative aspect-video bg-white">
                {p.imageUrl
                  ? <img src={mediaUrl(p.imageUrl)} alt={p.caption || p.prompt || `Viñeta ${i + 1}`} className="h-full w-full object-cover" />
                  : <div className="halftone grid h-full place-items-center bg-sun/40 text-sm font-bold">Sin imagen</div>}
                {p.caption && (
                  <figcaption className="absolute left-0 top-0 max-w-[85%] border-b-[3px] border-r-[3px] border-ink bg-sun px-3 py-1.5 text-sm font-bold">
                    {p.caption}
                  </figcaption>
                )}
                {p.dialogue && (
                  <div className="absolute bottom-3 right-3 max-w-[75%] rounded-[1.4rem] border-[3px] border-ink bg-white px-4 py-2 text-sm font-semibold shadow-hard-sm">
                    {p.dialogue}
                  </div>
                )}
              </div>
              {p.voiceUrl && (
                <div className="flex items-center gap-2 border-t-[3px] border-ink bg-white px-3 py-2">
                  <Play className="h-4 w-4" aria-hidden />
                  <audio controls src={mediaUrl(p.voiceUrl)} className="h-8 w-full" aria-label={`Voz de la viñeta ${i + 1}`} />
                </div>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
