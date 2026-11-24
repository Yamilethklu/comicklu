import { useState } from "react";
import { Link } from "wouter";
import { Sparkles, Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { mediaUrl } from "@/lib/native";
import { Page, ErrorNote } from "@/components/Layout";
import { STYLES, type StyleId } from "@shared/plans";
export default function ComicGenerator() {
 const [idea,setIdea]=useState("");
 const [style,setStyle]=useState<StyleId>("_3d");
 const [language,setLanguage]=useState("español");
 const [panelCount,setPanelCount]=useState(6);
 const [url,setUrl]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null);
 async function generate(){
  setBusy(true);setError(null);
  try { const result=await api<{url:string}>("POST","/api/ai/page",{idea,style,language,panelCount});setUrl(mediaUrl(result.url)); }
  catch(e){setError(errMsg(e));} finally{setBusy(false);}
 }
 return <Page><div className="mb-6"><Link href="/dashboard" className="btn-ghost">Mi estudio</Link><h1 className="title-comic mt-4 text-5xl">Crea tu cómic con IA</h1><p className="mt-2">Una idea, una página completa. Ilustraciones, viñetas y diálogos en un solo paso.</p></div>
 <div className="grid gap-6 lg:grid-cols-2"><form className="frame space-y-4 p-5" onSubmit={e=>{e.preventDefault();if(!busy)void generate();}}>
 <label className="block font-bold">Tu historia<textarea className="mt-2 block w-full rounded-lg border-2 border-ink p-3" rows={7} required minLength={10} maxLength={700} value={idea} onChange={e=>setIdea(e.target.value)} placeholder="Una palmera emprendedora funda una marca de bebidas tropicales..."/></label>
 <label className="block font-bold">Estilo<select className="block w-full rounded border p-2" value={style} onChange={e=>setStyle(e.target.value as StyleId)}>{Object.entries(STYLES).map(([id,s])=><option key={id} value={id}>{s.name}</option>)}</select></label>
 <label className="block font-bold">Idioma<input className="block w-full rounded border p-2" required maxLength={40} value={language} onChange={e=>setLanguage(e.target.value)}/></label>
 <label className="block font-bold">Viñetas<select className="block w-full rounded border p-2" value={panelCount} onChange={e=>setPanelCount(Number(e.target.value))}>{[4,6,8].map(n=><option key={n}>{n}</option>)}</select></label>
 <button className="btn-pop w-full" disabled={busy||idea.trim().length<10}>{busy?<Loader2 className="h-5 w-5 animate-spin"/>:<Sparkles className="h-5 w-5"/>}{busy?"Ilustrando tu historia…":"Generar cómic completo"}</button><p className="text-xs">Consume una imagen de tu plan. La IA puede variar el número de viñetas o cometer errores de rotulación.</p><ErrorNote message={error}/></form>
 <section className="frame p-4"><h2 className="font-display text-2xl">Tu página</h2>{url?<><img src={url} alt="Página de cómic generada" className="mx-auto mt-3 max-h-[900px] w-full object-contain"/><a href={url} target="_blank" rel="noreferrer" className="btn-sun mt-4">Abrir imagen para guardar o imprimir</a></>:<div className="grid min-h-80 place-items-center text-center">Tu cómic aparecerá aquí.</div>}</section></div></Page>;
}
