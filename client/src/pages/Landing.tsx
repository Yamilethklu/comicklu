import { Link } from "wouter";
import { Film, Mic, PenLine, Sparkles, Wand2 } from "lucide-react";
import { Footer, Page } from "@/components/Layout";
import { useConfig, useMe } from "@/lib/hooks";
import { STYLES } from "@shared/plans";
import { PlanCards } from "./Pricing";

function ComicArt({variant=0}: {variant?:number}) {
 const palettes=[["#173e68","#ffcf32","#fa347c"],["#dedbd5","#fff","#222"],["#263c70","#f45c45","#ffc775"],["#191039","#fa347c","#26d9ff"],["#b9d9df","#dc776c","#f5e8ce"],["#283d87","#e45343","#ffd565"],["#222","#eee","#777"],["#23334d","#d94b39","#e6b786"]];
 const [sky,jacket,accent]=palettes[variant%8];
 return <svg viewBox="0 0 320 230" className="block h-full w-full" role="img" aria-label="Ilustración de una heroína sobre la ciudad">
 <rect width="320" height="230" fill={sky}/><circle cx="252" cy="48" r="29" fill={accent} opacity=".85"/>
 {Array.from({length:12},(_,i)=><g key={i}><rect x={i*29} y={90+(i*37)%65} width="25" height="145" fill="#10182c" stroke={accent} strokeWidth=".8"/>{Array.from({length:5},(_,j)=><rect key={j} x={i*29+5} y={155+j*12} width="5" height="6" fill={accent} opacity=".8"/>)}</g>)}
 <g stroke="#141323" strokeWidth={variant===5?5:3} strokeLinejoin="round"><path d="M120 91 Q77 40 49 83 Q34 115 79 133 L113 111" fill="#30232c"/><path d="M91 230 L100 160 Q111 137 145 133 L190 135 Q222 146 237 230Z" fill={jacket}/><path d="M145 135 L154 230 L194 230 L181 136" fill="#182039"/><path d="M147 118 L143 143 L165 160 L185 137 L180 111" fill="#d69b70"/><path d="M121 57 Q157 27 194 58 L205 93 L192 104 L188 122 Q165 144 143 123 L125 104Z" fill="#efb58a"/><path d="M118 104 Q97 70 122 45 Q157 20 190 45 Q211 57 207 83 L185 62 L178 89 L160 62 L145 93 L137 75 L129 106Z" fill="#30232c"/><path d="M171 94 L187 91 M178 115 L189 113" fill="none"/><ellipse cx="183" cy="97" rx="3" ry="5" fill="#141323"/><path d="M110 158 L132 177 L117 193 L139 230 M209 153 L192 176 L210 192 L192 230" fill="none"/><path d="M104 181 L121 181 L115 196Z" fill={accent}/></g>
 {variant===3&&Array.from({length:16},(_,i)=><path key={i} d={`M${i*23} 0 l-30 65`} stroke="#9eeaff" opacity=".5"/>)}
 </svg>
}
function HeroPage() {
 return <div className="relative w-full max-w-[460px] rotate-1 border-[4px] border-ink bg-[#fff5d8] p-3 shadow-hard-lg">
 <div className="halftone border-[3px] border-ink bg-pop p-2 text-center"><div className="font-display text-5xl italic text-sun drop-shadow-[3px_3px_0_#16132b] md:text-6xl">ComicKlu</div><div className="bg-ink font-display text-xl text-white">HERO PAGE</div></div>
 <div className="relative mt-2 overflow-hidden border-[3px] border-ink"><ComicArt/><span className="bubble absolute right-2 top-2 bg-white px-3 py-2 text-sm font-extrabold">¡La ciudad no duerme!</span></div>
 <div className="mt-2 grid grid-cols-2 gap-2"><div className="relative overflow-hidden border-[3px] border-ink"><ComicArt variant={3}/><span className="absolute bottom-1 left-1 -rotate-6 bg-sun px-2 font-display text-3xl text-ink">¡ZAP!</span></div><div className="overflow-hidden border-[3px] border-ink"><ComicArt variant={0}/></div></div>
 <div className="mt-2 bg-ink p-2 text-center font-display text-xl text-sun">TU HISTORIA COMIENZA AQUÍ</div></div>
}

const STEPS = [
  { icon: PenLine, t: "Escribe o deja que la IA te ayude", d: "Cuenta tu idea y obtén un guion dividido en viñetas con narración y diálogos.", c: "bg-sun" },
  { icon: Wand2, t: "Genera páginas completas con IA", d: "Selecciona estilo, personaje de referencia y número de páginas.", c: "bg-zap" },
  { icon: Mic, t: "Descarga tu libro", d: "Revisa tus páginas y exporta el PDF para imprimir.", c: "bg-pop text-white" },
];

// Cada estilo del catálogo debe tener una tarjeta visual. La tipificación detecta
// estilos nuevos que aún no tengan presentación antes de llegar a producción.
const STYLE_ART: Record<keyof typeof STYLES, { bg: string; d: string; tag: string }> = {
  comic: { bg: "bg-sun", d: "Contornos gruesos, color plano y puntos de trama.", tag: "¡POW!" },
  manga: { bg: "bg-white", d: "Blanco y negro con tramas y mucha expresión.", tag: "ドン" },
  anime: { bg: "bg-gradient-to-br from-pop to-grape", d: "Colores vivos y sombreado limpio de animación.", tag: "✦" },
  cyberpunk: { bg: "bg-gradient-to-br from-ink via-grape to-zap", d: "Neón, lluvia y ciudades que nunca apagan sus luces.", tag: "2077" },
  acuarela: { bg: "bg-gradient-to-br from-sky-200 to-pink-200", d: "Pinceladas suaves, acuarela y textura de papel.", tag: "🎨" },
  pixel: { bg: "bg-gradient-to-br from-emerald-300 to-violet-400", d: "Arte retro inspirado en videojuegos de 16 bits.", tag: "PIXEL" },
  noir: { bg: "bg-gradient-to-br from-slate-500 to-black", d: "Tinta negra, misterio y sombras cinematográficas.", tag: "NOIR" },
  _3d: { bg: "bg-gradient-to-br from-cyan-300 to-fuchsia-400", d: "Volumen, profundidad y escenarios renderizados.", tag: "3D" },
};

const MARQUEE = ["Guion con IA", "Imágenes con IA", "Voces con IA", "Cómic", "Manga", "Anime", "Cyberpunk"];

export default function Landing() {
  const { user } = useMe();
  const cfg = useConfig();
  const marquee = cfg?.video ? [...MARQUEE.slice(0, 3), "Video MP4", ...MARQUEE.slice(3)] : MARQUEE;
  return (
    <Page>
      <section className="grid items-center gap-12 rounded-xl border-[3px] border-ink bg-[#fff5d8] p-6 shadow-hard-lg md:grid-cols-2 md:p-10">
        <div>
          <p className="inline-flex -rotate-1 items-center gap-1.5 rounded-full border-[3px] border-ink bg-white px-3 py-1 text-xs font-extrabold shadow-hard-sm">
            <Sparkles className="h-3.5 w-3.5 text-pop" aria-hidden /> Estudio de cómics con IA
          </p>
          <h1 className="mt-4 font-display text-6xl leading-[0.95] tracking-wide md:text-7xl">
            Tu historia,<br /><span className="hl">un libro</span> de <span className="text-pop">cómic</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-ink/80">
            Convierte una idea y una imagen de referencia en un libro ilustrado, con páginas completas, diálogos y PDF para imprimir. Además,
            {cfg?.video ? " ponles voz y llévalas a video." : " ponles voz y guarda tus historietas en tu biblioteca."}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={user ? "/generar" : "/registro"} className="btn-pop btn-shine px-6 py-3 text-base">{user ? "Crear mi libro" : "Empezar gratis"}</Link>
            <Link href="/precios" className="btn-ghost px-6 py-3 text-base">Ver planes</Link>
          </div>
          <p className="mt-4 text-sm font-semibold text-ink/60">Sin tarjeta · Plan Gratis para siempre</p>
        </div>
        <div className="flex justify-center md:justify-end"><HeroPage /></div>
      </section>

      {/* Cinta con las capacidades */}
      <div className="-mx-4 mt-10 overflow-hidden border-y-[3px] border-ink bg-sun py-2.5 sm:mx-0 sm:rounded-lg sm:border-[3px]" aria-hidden="true">
        <div className="flex w-max animate-marquee gap-8 font-display text-2xl tracking-wide">
          {[...marquee, ...marquee].map((m, i) => <span key={i} className="flex items-center gap-8">{m}<span className="text-pop">★</span></span>)}
        </div>
      </div>

      <section className="mt-16" aria-labelledby="estilos">
        <h2 id="estilos" className="title-comic text-4xl">Ocho estilos, un solo estudio</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.entries(STYLES) as [keyof typeof STYLES, { name: string; prompt: string }][]).map(([k, s], i) => (
            <div key={k} className="frame frame-hover overflow-hidden shadow-hard">
              <div className="aspect-[4/3] overflow-hidden border-b-[3px] border-ink"><ComicArt variant={i}/></div>
              <div className="p-4">
                <h3 className="text-lg font-extrabold">{s.name}</h3>
                <p className="mt-1 text-sm text-ink/70">{STYLE_ART[k].d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16" aria-labelledby="como">
        <h2 id="como" className="title-comic text-4xl">Cómo funciona ComicKlu en 3 pasos</h2>
        <ol className="mt-6 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.t} className="frame frame-hover relative p-5 shadow-hard">
              <span className={`absolute -right-3 -top-4 grid h-10 w-10 rotate-6 place-items-center rounded-full border-[3px] border-ink font-display text-xl shadow-hard-sm ${s.c}`}>{i + 1}</span>
              <div className="mb-4 overflow-hidden rounded-md border-[3px] border-ink bg-[#fff5d8]"><div className="bg-ink px-3 py-2 text-xs font-bold text-white">{["Editor de guion","Estudio de ilustración","Biblioteca de cómics"][i]}</div>{i===1?<ComicArt/>:i===0?<div className="space-y-2 p-3">{["La llegada","El encuentro","La aventura"].map((t,n)=><div key={t} className="border-2 border-ink bg-white p-2 text-xs font-bold text-ink">PANEL {n+1} · {t}</div>)}</div>:<div className="p-3"><div className="mb-2 bg-pop p-2 text-center font-bold text-white">▶ Narración</div><ComicArt variant={2}/></div>}</div><s.icon className="h-8 w-8" aria-hidden />
              <h3 className="mt-3 text-lg font-extrabold">{s.t}</h3>
              <p className="mt-1 text-sm text-ink/70">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {cfg && (
        <section className="mt-16" aria-labelledby="planes">
          <h2 id="planes" className="title-comic text-4xl">Empieza gratis, crece cuando quieras</h2>
          <div className="mt-6"><PlanCards compact /></div>
        </section>
      )}

      {/* Llamada final a la acción */}
      <section className="frame relative mt-20 overflow-hidden bg-ink p-8 text-center text-white shadow-hard-lg md:p-12" aria-labelledby="cta">
        <div className="halftone absolute inset-0 opacity-10" aria-hidden />
        <Film className="relative mx-auto h-10 w-10 text-sun" aria-hidden />
        <h2 id="cta" className="relative mt-3 font-display text-5xl tracking-wide">Tu primera página te espera</h2>
        <p className="relative mx-auto mt-2 max-w-md text-white/80">Crea tu cuenta gratis y convierte una idea en un cómic con voz y arte propio.</p>
        <Link href={user ? "/generar" : "/registro"} className="btn-sun btn-shine relative mt-6 px-8 py-3 text-base">{user ? "Crear mi libro" : "Crear mi cómic"}</Link>
      </section>

      <Footer />
    </Page>
  );
}
