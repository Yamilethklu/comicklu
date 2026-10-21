import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Film, Loader2, Plus, Sparkles } from "lucide-react";
import { api, errMsg, ApiError } from "@/lib/api";
import { isNative, mediaUrl, openExternal } from "@/lib/native";
import { Share } from "@capacitor/share";
import { useConfig, useMe } from "@/lib/hooks";
import { Nav } from "@/components/Layout";
import { PanelEditor, type ClientPanel } from "@/components/PanelEditor";
import { Reader } from "@/components/Reader";
import type { ComicData, RenderRow } from "@/lib/types";
import { STYLES, METRIC_LABEL, type StyleId, type Metric } from "@shared/plans";

type StudioComic = Omit<ComicData, "panels"> & { panels: ClientPanel[] };
type Tab = "historia" | "vinetas" | "estilo" | "vista" | "exportar";
const TABS: { id: Tab; label: string }[] = [
  { id: "historia", label: "Historia" }, { id: "vinetas", label: "Viñetas" }, { id: "estilo", label: "Estilo" },
  { id: "vista", label: "Vista previa" }, { id: "exportar", label: "Exportar" },
];
const uid = () => Math.random().toString(36).slice(2, 10);
const blankPanel = (): ClientPanel => ({ uid: uid(), imageUrl: null, caption: "", dialogue: "", prompt: "", voiceUrl: null });

function toPayload(c: StudioComic) {
  return {
    title: c.title.trim() || "Sin título", synopsis: c.synopsis, story: c.story, style: c.style, settings: c.settings,
    coverUrl: c.panels.find((p) => p.imageUrl)?.imageUrl ?? null,
    panels: c.panels.map(({ uid: _u, ...p }) => p),
  };
}

export default function Studio({ id }: { id: number }) {
  const qc = useQueryClient();
  const { me } = useMe();
  const cfg = useConfig();
  const [comic, setComic] = useState<StudioComic | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("historia");
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [notice, setNotice] = useState<{ msg: string; upgrade: boolean } | null>(null);
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [storyBusy, setStoryBusy] = useState(false);
  const [idea, setIdea] = useState("");
  const [panelCount, setPanelCount] = useState(6);
  const [renders, setRenders] = useState<RenderRow[]>([]);
  const [videoBusy, setVideoBusy] = useState(false);

  const latest = useRef<StudioComic | null>(null);
  latest.current = comic;
  const dirty = useRef(false);
  const chain = useRef<Promise<void>>(Promise.resolve());

  const fail = (e: unknown) => setNotice({ msg: errMsg(e), upgrade: e instanceof ApiError && e.status === 402 });
  const refreshMe = () => qc.invalidateQueries({ queryKey: ["me"] });

  useEffect(() => {
    api<ComicData>("GET", `/api/comics/${id}`)
      .then((c) => setComic({ ...c, panels: c.panels.map((p) => ({ ...p, uid: uid() })) }))
      .catch((e) => setLoadError(errMsg(e)));
  }, [id]);

  const save = useCallback(() => {
    chain.current = chain.current.then(async () => {
      const c = latest.current;
      if (!c || !dirty.current) return;
      dirty.current = false;
      setSaveState("saving");
      try {
        await api("PUT", `/api/comics/${c.id}`, toPayload(c));
        setSaveState(dirty.current ? "dirty" : "saved");
        qc.invalidateQueries({ queryKey: ["comics"] });
      } catch (e) { dirty.current = true; setSaveState("error"); fail(e); }
    });
    return chain.current;
  }, [qc]);

  const edit = (fn: (c: StudioComic) => StudioComic) => {
    setComic((c) => (c ? fn(c) : c));
    dirty.current = true; setSaveState("dirty");
  };
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(save, 1200);
    return () => clearTimeout(t);
  }, [comic, save]);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty.current) e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const loadRenders = useCallback(() => api<RenderRow[]>("GET", `/api/comics/${id}/renders`).then(setRenders).catch(() => {}), [id]);
  useEffect(() => { if (tab === "exportar") loadRenders(); }, [tab, loadRenders]);
  const rendering = renders.some((r) => r.status === "queued" || r.status === "processing");
  useEffect(() => {
    if (!rendering) return;
    const t = setInterval(loadRenders, 2500);
    return () => clearInterval(t);
  }, [rendering, loadRenders]);

  if (loadError) return (<div className="min-h-screen"><Nav /><div className="mx-auto max-w-md p-10 text-center"><p className="font-bold">{loadError}</p><Link href="/dashboard" className="btn-sun mt-4">Volver a mi biblioteca</Link></div></div>);
  if (!comic || !me?.limits || !cfg) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-8 w-8 animate-spin" aria-label="Cargando" /></div>;

  const limits = me.limits;
  const usage = me.usage!;
  const maxPanels = limits.panelsPerComic;
  const setPanel = (uidv: string, patch: Partial<ClientPanel>) => edit((c) => ({ ...c, panels: c.panels.map((p) => (p.uid === uidv ? { ...p, ...patch } : p)) }));
  const setBusyFor = (k: string, v: string | null) => setBusy((b) => { const n = { ...b }; if (v) n[k] = v; else delete n[k]; return n; });

  const addPanel = () => {
    if (comic.panels.length >= maxPanels) return setNotice({ msg: `Tu plan permite ${maxPanels} viñetas por cómic.`, upgrade: true });
    edit((c) => ({ ...c, panels: [...c.panels, blankPanel()] }));
  };
  const movePanel = (i: number, dir: -1 | 1) => edit((c) => {
    const ps = [...c.panels]; [ps[i], ps[i + dir]] = [ps[i + dir], ps[i]]; return { ...c, panels: ps };
  });

  const genImage = async (p: ClientPanel) => {
    setNotice(null); setBusyFor(p.uid, "image");
    try {
      const { url } = await api<{ url: string }>("POST", "/api/ai/image", {
        prompt: p.prompt, style: comic.style, palette: comic.settings.palette || undefined,
        orientation: "landscape",
      });
      setPanel(p.uid, { imageUrl: url }); refreshMe();
    } catch (e) { fail(e); } finally { setBusyFor(p.uid, null); }
  };
  const genVoice = async (p: ClientPanel, voice: string) => {
    setNotice(null); setBusyFor(p.uid, "voice");
    try {
      const text = [p.caption, p.dialogue].filter(Boolean).join(". ");
      const { url } = await api<{ url: string }>("POST", "/api/ai/voice", { text, voice, language: comic.settings.language || undefined });
      setPanel(p.uid, { voiceUrl: url }); refreshMe();
    } catch (e) { fail(e); } finally { setBusyFor(p.uid, null); }
  };
  const genStory = async () => {
    const hasContent = comic.panels.some((p) => p.caption || p.dialogue || p.prompt || p.imageUrl);
    if (hasContent && !confirm("El guion generado reemplazará tus viñetas actuales. ¿Continuar?")) return;
    setNotice(null); setStoryBusy(true);
    try {
      const r = await api<{ title: string; synopsis: string; panels: { caption: string; dialogue: string; prompt: string }[] }>("POST", "/api/ai/story", {
        idea, style: comic.style, tone: comic.settings.tone || undefined, language: comic.settings.language || "español", panelCount,
      });
      edit((c) => ({
        ...c,
        title: !c.title || c.title === "Cómic sin título" ? r.title : c.title,
        synopsis: r.synopsis,
        panels: r.panels.slice(0, maxPanels).map((p) => ({ ...blankPanel(), ...p })),
      }));
      refreshMe(); setTab("vinetas");
    } catch (e) { fail(e); } finally { setStoryBusy(false); }
  };

  const exportJson = async () => {
    await save();
    if (!isNative) { window.location.href = `/api/comics/${id}/export.json`; return; }
    try {
      const data = await api("GET", `/api/comics/${id}/export.json`);
      await Share.share({ title: comic.title || "Cómic", text: JSON.stringify(data, null, 2) });
    } catch (e) { fail(e); }
  };
  const startVideo = async () => {
    setNotice(null); setVideoBusy(true);
    try { await save(); await api("POST", `/api/comics/${id}/video`); await loadRenders(); refreshMe(); }
    catch (e) { fail(e); } finally { setVideoBusy(false); }
  };

  const quota = (m: Metric) => `${usage[m]}/${limits.monthly[m]}`;
  const lastDone = renders.find((r) => r.status === "done");
  const lastFailed = renders[0]?.status === "failed" ? renders[0] : null;
  const saveLabel = { saved: "Guardado", dirty: "Cambios sin guardar…", saving: "Guardando…", error: "Error al guardar" }[saveState];

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/dashboard" className="btn-ghost !px-2.5" aria-label="Volver a mi biblioteca"><ArrowLeft className="h-4 w-4" /></Link>
          <label className="sr-only" htmlFor="title">Título del cómic</label>
          <input id="title" className="min-w-0 flex-1 border-b-[3px] border-ink bg-transparent font-display text-4xl tracking-wide outline-none focus-visible:border-pop"
            value={comic.title} onChange={(e) => edit((c) => ({ ...c, title: e.target.value }))} maxLength={120} placeholder="Título del cómic" />
          <span className={`text-sm font-bold ${saveState === "error" ? "text-pop" : "text-ink/60"}`} role="status">{saveLabel}</span>
          {saveState === "error" && <button className="btn-ghost" onClick={() => { dirty.current = true; save(); }}>Reintentar</button>}
        </div>

        <div role="tablist" aria-label="Secciones del estudio" className="mt-5 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={`rounded-lg border-[3px] border-ink px-4 py-2 text-sm font-extrabold ${tab === t.id ? "bg-ink text-white" : "bg-white hover:bg-sun/50"}`}>{t.label}</button>
          ))}
        </div>

        {notice && (
          <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border-2 border-ink bg-pop/15 px-3 py-2 text-sm font-semibold">
            <span className="flex-1">{notice.msg}</span>
            {notice.upgrade && <Link href="/precios" className="btn-sun !py-1">Ver planes</Link>}
            <button className="underline" onClick={() => setNotice(null)}>Cerrar</button>
          </div>
        )}
        {!cfg.ai && <p className="mt-4 rounded-lg border-2 border-ink bg-sun/40 px-3 py-2 text-sm">La IA no está activada en este servidor. Puedes escribir y subir imágenes con normalidad.</p>}

        <div className="mt-6" role="tabpanel">
          {tab === "historia" && (
            <div className="grid gap-6 md:grid-cols-2">
              <section className="frame space-y-4 p-5" aria-labelledby="h-story">
                <h2 id="h-story" className="text-xl font-extrabold">Tu historia</h2>
                <div>
                  <label className="label" htmlFor="syn">Sinopsis</label>
                  <textarea id="syn" className="field min-h-20" value={comic.synopsis} maxLength={2000} onChange={(e) => edit((c) => ({ ...c, synopsis: e.target.value }))} placeholder="¿De qué trata en dos o tres líneas?" />
                </div>
                <div>
                  <label className="label" htmlFor="story">Historia completa</label>
                  <textarea id="story" className="field min-h-56" value={comic.story} maxLength={20000} onChange={(e) => edit((c) => ({ ...c, story: e.target.value }))} placeholder="Escribe aquí tu guion, notas de personajes o el mundo de tu cómic." />
                </div>
              </section>
              <section className="frame space-y-4 bg-sun/30 p-5" aria-labelledby="h-ai">
                <h2 id="h-ai" className="text-xl font-extrabold">Guion con IA</h2>
                <p className="text-sm text-ink/70">Cuenta tu idea y te devolvemos las viñetas con narración, diálogos y la descripción visual de cada escena. Este mes: {quota("story")} guiones usados.</p>
                <div>
                  <label className="label" htmlFor="idea">Tu idea</label>
                  <textarea id="idea" className="field min-h-28" value={idea} onChange={(e) => setIdea(e.target.value)} maxLength={3000}
                    placeholder="Una detective en una ciudad flotante descubre que la lluvia es una señal enviada por su hermana desaparecida…" />
                </div>
                <div>
                  <label className="label" htmlFor="count">Número de viñetas: {panelCount}</label>
                  <input id="count" type="range" min={2} max={Math.min(24, maxPanels)} value={panelCount} onChange={(e) => setPanelCount(Number(e.target.value))} className="w-full accent-pop" />
                </div>
                <button className="btn-pop" onClick={genStory} disabled={storyBusy || idea.trim().length < 10 || !cfg.ai}>
                  {storyBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Generar guion
                </button>
              </section>
            </div>
          )}

          {tab === "vinetas" && (
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink/70">{comic.panels.length} de {maxPanels} viñetas · imágenes con IA: {quota("image")} · voces: {quota("voice")}</p>
                <button className="btn-pop" onClick={addPanel}><Plus className="h-4 w-4" />Agregar viñeta</button>
              </div>
              {comic.panels.length === 0 ? (
                <div className="frame p-10 text-center">
                  <p className="font-display text-3xl tracking-wide">Aún no hay viñetas</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-ink/70">Agrega la primera o genera un guion completo en la pestaña «Historia».</p>
                  <button className="btn-pop mt-4" onClick={addPanel}>Agregar la primera viñeta</button>
                </div>
              ) : (
                <ul className="space-y-5">
                  {comic.panels.map((p, i) => (
                    <PanelEditor key={p.uid} index={i} total={comic.panels.length} panel={p} busy={busy[p.uid] ?? null}
                      aiImage={cfg.ai} aiVoice={cfg.ai && limits.monthly.voice > 0}
                      onChange={(patch) => setPanel(p.uid, patch)} onMove={(d) => movePanel(i, d)}
                      onDelete={() => edit((c) => ({ ...c, panels: c.panels.filter((x) => x.uid !== p.uid) }))}
                      onGenerateImage={() => genImage(p)} onGenerateVoice={(v) => genVoice(p, v)}
                      onError={(msg) => setNotice({ msg, upgrade: false })} />
                  ))}
                </ul>
              )}
              {limits.monthly.voice === 0 && <p className="mt-4 text-sm text-ink/70">Las voces con IA se incluyen desde el plan Pro. <Link href="/precios" className="font-bold underline">Ver planes</Link></p>}
            </div>
          )}

          {tab === "estilo" && (
            <div className="grid gap-6 md:grid-cols-2">
              <section className="frame p-5" aria-labelledby="h-style">
                <h2 id="h-style" className="text-xl font-extrabold">Estilo visual</h2>
                <div className="mt-3 grid grid-cols-2 gap-3" role="radiogroup" aria-labelledby="h-style">
                  {(Object.keys(STYLES) as StyleId[]).map((k) => (
                    <button key={k} role="radio" aria-checked={comic.style === k} onClick={() => edit((c) => ({ ...c, style: k }))}
                      className={`rounded-lg border-[3px] border-ink p-3 text-left ${comic.style === k ? "bg-sun shadow-hard-sm" : "bg-white hover:bg-sun/30"}`}>
                      <span className="block font-extrabold">{STYLES[k].name}</span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="frame space-y-4 p-5" aria-labelledby="h-set">
                <h2 id="h-set" className="text-xl font-extrabold">Ajustes</h2>
                <div>
                  <label className="label" htmlFor="tone">Tono</label>
                  <input id="tone" className="field" value={comic.settings.tone ?? ""} onChange={(e) => edit((c) => ({ ...c, settings: { ...c.settings, tone: e.target.value } }))} placeholder="Épico, humor negro, melancólico…" maxLength={80} />
                </div>
                <div>
                  <label className="label" htmlFor="lang">Idioma del cómic</label>
                  <input id="lang" className="field" value={comic.settings.language ?? ""} onChange={(e) => edit((c) => ({ ...c, settings: { ...c.settings, language: e.target.value } }))} placeholder="español" maxLength={40} />
                </div>
                <div>
                  <label className="label" htmlFor="pal">Paleta de colores</label>
                  <input id="pal" className="field" value={comic.settings.palette ?? ""} onChange={(e) => edit((c) => ({ ...c, settings: { ...c.settings, palette: e.target.value } }))} placeholder="Magenta, cian y negro" maxLength={200} />
                </div>
                <div>
                  <label className="label" htmlFor="lay">Lectura en la vista previa</label>
                  <select id="lay" className="field" value={comic.settings.layout ?? "vertical"} onChange={(e) => edit((c) => ({ ...c, settings: { ...c.settings, layout: e.target.value as "vertical" | "horizontal" } }))}>
                    <option value="vertical">Vertical (una columna)</option>
                    <option value="horizontal">Cuadrícula</option>
                  </select>
                </div>
              </section>
            </div>
          )}

          {tab === "vista" && <Reader comic={comic} />}

          {tab === "exportar" && (
            <div className="grid gap-6 md:grid-cols-2">
              <section className="frame p-5" aria-labelledby="h-json">
                <h2 id="h-json" className="text-xl font-extrabold">Ficha del proyecto (JSON)</h2>
                <p className="mt-1 text-sm text-ink/70">Descarga el título, la historia, el estilo y todas las viñetas con sus textos.</p>
                <button className="btn-sun mt-4" onClick={exportJson}><Download className="h-4 w-4" />Descargar JSON</button>
              </section>
              <section className="frame p-5" aria-labelledby="h-video">
                <h2 id="h-video" className="text-xl font-extrabold">Video animado</h2>
                {limits.monthly.video === 0 ? (
                  <>
                    <p className="mt-1 text-sm text-ink/70">Convierte tus viñetas en un video MP4 con movimiento de cámara, subtítulos y tu narración. Disponible desde el plan Pro.</p>
                    <Link href="/precios" className="btn-pop mt-4">Mejorar a Pro</Link>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-ink/70">Une las viñetas con imagen en un MP4 (720p) con movimiento suave, subtítulos y la voz que hayas generado. Este mes: {quota("video")} videos.</p>
                    <button className="btn-pop mt-4" onClick={startVideo} disabled={videoBusy || rendering}>
                      {videoBusy || rendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}{rendering ? "Renderizando…" : "Crear video"}
                    </button>
                    {lastFailed && <p role="alert" className="mt-3 rounded-lg border-2 border-ink bg-pop/15 px-3 py-2 text-sm font-semibold">No se pudo crear el video: {lastFailed.error} (no se descontó de tu plan).</p>}
                    {lastDone?.url && (
                      <div className="mt-4">
                        <video src={mediaUrl(lastDone.url)} controls className="w-full rounded-lg border-[3px] border-ink bg-black" />
                        <a href={mediaUrl(lastDone.url)} download className="btn-ghost mt-2" onClick={isNative ? (e) => { e.preventDefault(); openExternal(mediaUrl(lastDone.url!)); } : undefined}><Download className="h-4 w-4" />Descargar MP4</a>
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
