import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Link2, Loader2, Mic, Sparkles, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/native";
import type { PanelData } from "@/lib/types";

export type ClientPanel = PanelData & { uid: string };

interface Props {
  index: number; total: number; panel: ClientPanel;
  busy: string | null; // "image" | "voice" | "upload" | null (acción en curso para esta viñeta)
  aiImage: boolean; aiVoice: boolean;
  onChange: (patch: Partial<PanelData>) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onGenerateImage: () => void;
  onGenerateVoice: (voice: string) => void;
  onError: (msg: string) => void;
}

export function PanelEditor({ index, total, panel, busy, aiImage, aiVoice, onChange, onMove, onDelete, onGenerateImage, onGenerateVoice, onError }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [voice, setVoice] = useState("nova");
  const [loading, setLoading] = useState(false);

  const upload = async (send: () => Promise<{ url: string }>) => {
    setLoading(true);
    try { onChange({ imageUrl: (await send()).url }); setUrlOpen(false); setUrl(""); }
    catch (e) { onError(e instanceof Error ? e.message : "No se pudo subir la imagen"); }
    finally { setLoading(false); }
  };
  const onFile = (f?: File) => {
    if (!f) return;
    const fd = new FormData(); fd.append("file", f);
    upload(() => api("POST", "/api/uploads", fd));
  };
  const working = loading || busy === "image";

  return (
    <li className="frame p-4 shadow-hard">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-2xl tracking-wide">Viñeta {index + 1}</h3>
        <div className="flex gap-1">
          <button className="rounded p-1.5 hover:bg-ink/10 disabled:opacity-30" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Subir viñeta ${index + 1}`}><ArrowUp className="h-4 w-4" /></button>
          <button className="rounded p-1.5 hover:bg-ink/10 disabled:opacity-30" disabled={index === total - 1} onClick={() => onMove(1)} aria-label={`Bajar viñeta ${index + 1}`}><ArrowDown className="h-4 w-4" /></button>
          <button className="rounded p-1.5 hover:bg-pop/20" onClick={onDelete} aria-label={`Eliminar viñeta ${index + 1}`}><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,280px)_1fr]">
        <div>
          <div className="halftone relative grid aspect-video place-items-center overflow-hidden rounded-lg border-[3px] border-ink bg-sun/30">
            {panel.imageUrl ? <img src={mediaUrl(panel.imageUrl)} alt={`Imagen de la viñeta ${index + 1}`} className="h-full w-full object-cover" />
              : <span className="rounded bg-white/90 px-2 py-1 text-xs font-bold">Sin imagen</span>}
            {working && <div className="absolute inset-0 grid place-items-center bg-white/70"><Loader2 className="h-7 w-7 animate-spin" aria-label="Procesando imagen" /></div>}
            {panel.imageUrl && !working && (
              <button className="absolute right-1 top-1 rounded-full border-2 border-ink bg-white p-1" onClick={() => onChange({ imageUrl: null })} aria-label="Quitar imagen"><X className="h-3.5 w-3.5" /></button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
            <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => fileRef.current?.click()} disabled={working}><ImagePlus className="h-3.5 w-3.5" />Subir</button>
            <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => setUrlOpen((v) => !v)} disabled={working} aria-expanded={urlOpen}><Link2 className="h-3.5 w-3.5" />Enlace</button>
            <button className="btn-sun !px-2.5 !py-1.5 text-xs" onClick={onGenerateImage} disabled={working || !aiImage || !panel.prompt.trim()}
              title={!aiImage ? "La IA no está activada en el servidor" : !panel.prompt.trim() ? "Escribe primero la descripción de la escena" : undefined}>
              <Sparkles className="h-3.5 w-3.5" />Generar con IA
            </button>
          </div>
          {urlOpen && (
            <div className="mt-2 flex gap-2">
              <input className="field !py-1.5" placeholder="https://…/imagen.png" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Enlace de la imagen" />
              <button className="btn-pop !px-3 !py-1.5 text-xs" disabled={!url.trim() || loading} onClick={() => upload(() => api("POST", "/api/uploads/from-url", { url: url.trim() }))}>Usar</button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="label" htmlFor={`p-prompt-${panel.uid}`}>Descripción de la escena (para la IA)</label>
            <textarea id={`p-prompt-${panel.uid}`} className="field min-h-16" value={panel.prompt} onChange={(e) => onChange({ prompt: e.target.value })} maxLength={1500}
              placeholder="Una detective bajo la lluvia mira un callejón iluminado en neón…" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor={`p-cap-${panel.uid}`}>Narración</label>
              <textarea id={`p-cap-${panel.uid}`} className="field min-h-16" value={panel.caption} onChange={(e) => onChange({ caption: e.target.value })} maxLength={1000} />
            </div>
            <div>
              <label className="label" htmlFor={`p-dia-${panel.uid}`}>Diálogo</label>
              <textarea id={`p-dia-${panel.uid}`} className="field min-h-16" value={panel.dialogue} onChange={(e) => onChange({ dialogue: e.target.value })} maxLength={1000} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="field !w-auto !py-1.5" value={voice} onChange={(e) => setVoice(e.target.value)} aria-label="Voz">
              {["nova", "alloy", "echo", "fable", "onyx", "shimmer"].map((v) => <option key={v}>{v}</option>)}
            </select>
            <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => onGenerateVoice(voice)}
              disabled={busy === "voice" || !aiVoice || !(panel.dialogue || panel.caption).trim()}
              title={!aiVoice ? "La voz con IA no está disponible en tu plan o en este servidor" : undefined}>
              {busy === "voice" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}Generar voz
            </button>
            {panel.voiceUrl && (
              <>
                <audio controls src={mediaUrl(panel.voiceUrl)} className="h-8 max-w-[220px]" aria-label={`Voz de la viñeta ${index + 1}`} />
                <button className="rounded p-1.5 hover:bg-pop/20" onClick={() => onChange({ voiceUrl: null })} aria-label="Quitar voz"><X className="h-4 w-4" /></button>
              </>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
