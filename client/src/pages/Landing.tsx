import { Link } from "wouter";
import { Film, Mic, PenLine, Sparkles, Wand2 } from "lucide-react";
import { Footer, Page } from "@/components/Layout";
import { useConfig, useMe } from "@/lib/hooks";
import { STYLES } from "@shared/plans";
import { PlanCards } from "./Pricing";

function HeroPage() {
 return <img src="/landing/hero.webp" alt="ComicKlu: la ciudad no duerme, portada ilustrada" className="block w-full max-w-[460px] rotate-1 rounded-sm border-[3px] border-ink shadow-hard-lg" fetchPriority="high" />;
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
          {(Object.entries(STYLES) as [keyof typeof STYLES, { name: string; prompt: string }][]).map(([k, s]) => (
            <div key={k} className="frame frame-hover overflow-hidden shadow-hard">
              <div className="aspect-[4/3] overflow-hidden border-b-[3px] border-ink"><img src={`/landing/${k === "_3d" ? "3d" : k}.webp`} alt={s.name} loading="lazy" className="h-full w-full object-cover" /></div>
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
        <figure className="mt-6 overflow-hidden rounded-xl border-[3px] border-ink bg-white shadow-hard"><img src="/landing/workflow.webp" alt="Ilustración de los tres pasos: escribir guion, generar viñetas y guardar el cómic" loading="lazy" className="block h-auto w-full" /><figcaption className="px-4 py-2 text-sm text-ink/70">Vista conceptual del proceso creativo.</figcaption></figure>
        <ol className="mt-6 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.t} className="frame frame-hover relative p-5 shadow-hard">
              <span className={`absolute -right-3 -top-4 grid h-10 w-10 rotate-6 place-items-center rounded-full border-[3px] border-ink font-display text-xl shadow-hard-sm ${s.c}`}>{i + 1}</span>
              <s.icon className="h-8 w-8" aria-hidden />
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
