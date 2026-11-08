import { Link } from "wouter";
import { Film, Mic, PenLine, Sparkles, Wand2 } from "lucide-react";
import { Footer, Page } from "@/components/Layout";
import { useConfig, useMe } from "@/lib/hooks";
import { STYLES } from "@shared/plans";
import { PlanCards } from "./Pricing";

function HeroPage() {
  // Una página de cómic hecha con CSS: el primer vistazo ya es una viñeta, con stickers flotando.
  return (
    <div className="relative w-full max-w-[460px]" aria-hidden="true">
      <div className="frame grid aspect-[4/5] w-full grid-cols-6 grid-rows-6 gap-2 bg-ink p-2 shadow-hard-lg rotate-1">
        <div className="relative col-span-4 row-span-3 overflow-hidden rounded-md border-[3px] border-ink bg-gradient-to-br from-zap to-grape">
          <div className="halftone absolute inset-0 opacity-20" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-ink/80" />
          <div className="absolute bottom-3 left-4 right-4 h-3 rounded-full bg-sun" />
          <div className="bubble absolute left-4 top-4 px-3 py-2 font-display text-lg leading-tight">¡La ciudad<br />no duerme!</div>
        </div>
        <div className="relative col-span-2 row-span-2 overflow-hidden rounded-md border-[3px] border-ink bg-pop">
          <div className="halftone absolute inset-0 opacity-25" />
          <div className="absolute inset-0 grid place-items-center font-display text-5xl text-white drop-shadow-[3px_3px_0_#16132b]">ZAP</div>
        </div>
        <div className="relative col-span-2 row-span-1 overflow-hidden rounded-md border-[3px] border-ink bg-sun">
          <div className="absolute inset-0 grid place-items-center font-display text-xl">¡BAM!</div>
        </div>
        <div className="relative col-span-3 row-span-3 overflow-hidden rounded-md border-[3px] border-ink bg-gradient-to-t from-mint to-sun">
          <div className="absolute -bottom-6 left-6 h-28 w-28 rounded-full border-[3px] border-ink bg-white" />
          <div className="absolute right-3 top-3 rounded-md border-[3px] border-ink bg-white px-2 py-1 text-xs font-extrabold">Capítulo 1</div>
        </div>
        <div className="relative col-span-3 row-span-3 overflow-hidden rounded-md border-[3px] border-ink bg-white">
          <div className="halftone absolute inset-0 opacity-30" />
          <div className="bubble bubble-r absolute bottom-6 left-4 right-4 rounded-[50%] px-4 py-3 text-center text-sm font-extrabold">Pon voz a tu historia</div>
        </div>
      </div>
      {/* Stickers flotantes */}
      <div className="burst absolute -left-8 -top-6 grid h-24 w-24 animate-float place-items-center bg-sun font-display text-2xl leading-none ring-0" style={{ ["--r" as string]: "-12deg" }}>
        <span className="-rotate-12 text-center">¡IA<br />POW!</span>
      </div>
      <div className="absolute -bottom-5 -right-3 animate-float-slow rounded-lg border-[3px] border-ink bg-mint px-3 py-1.5 text-sm font-extrabold shadow-hard-sm" style={{ ["--r" as string]: "5deg" }}>
        MP4 listo en minutos
      </div>
    </div>
  );
}

const STEPS = [
  { icon: PenLine, t: "Escribe o deja que la IA te ayude", d: "Cuenta tu idea y obtén un guion dividido en viñetas con narración y diálogos.", c: "bg-sun" },
  { icon: Wand2, t: "Dale imagen a cada viñeta", d: "Genera la ilustración con IA, sube la tuya o pega un enlace.", c: "bg-zap" },
  { icon: Mic, t: "Agrega voz y exporta", d: "Narra con voces de IA y descarga un video animado o la ficha del proyecto.", c: "bg-pop text-white" },
];

const STYLE_ART = [
  { bg: "bg-sun", d: "Contornos gruesos, color plano y puntos de trama.", tag: "¡POW!" },
  { bg: "bg-white", d: "Blanco y negro con tramas y mucha expresión.", tag: "ドン" },
  { bg: "bg-gradient-to-br from-pop to-grape", d: "Colores vivos y sombreado limpio de animación.", tag: "✦" },
  { bg: "bg-gradient-to-br from-ink via-grape to-zap", d: "Neón, lluvia y ciudades que nunca apagan sus luces.", tag: "2077" },
];

const MARQUEE = ["Guion con IA", "Imágenes con IA", "Voces con IA", "Video MP4", "Cómic", "Manga", "Anime", "Cyberpunk"];

export default function Landing() {
  const { user } = useMe();
  const cfg = useConfig();
  return (
    <Page>
      <section className="grid items-center gap-12 py-6 md:grid-cols-2">
        <div>
          <p className="inline-flex -rotate-1 items-center gap-1.5 rounded-full border-[3px] border-ink bg-white px-3 py-1 text-xs font-extrabold shadow-hard-sm">
            <Sparkles className="h-3.5 w-3.5 text-pop" aria-hidden /> Estudio de cómics con IA
          </p>
          <h1 className="mt-4 font-display text-6xl leading-[0.95] tracking-wide md:text-7xl">
            Tu historia,<br /><span className="hl">viñeta</span> por <span className="text-pop">viñeta</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-ink/80">
            Panelforge es un estudio para crear cómics, manga, anime y cyberpunk. Escribe el guion, genera las imágenes con IA,
            ponles voz y llévalas a video.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={user ? "/dashboard" : "/registro"} className="btn-pop btn-shine px-6 py-3 text-base">{user ? "Ir a mi biblioteca" : "Empezar gratis"}</Link>
            <Link href="/precios" className="btn-ghost px-6 py-3 text-base">Ver planes</Link>
          </div>
          <p className="mt-4 text-sm font-semibold text-ink/60">Sin tarjeta · Plan Gratis para siempre</p>
        </div>
        <div className="flex justify-center md:justify-end"><HeroPage /></div>
      </section>

      {/* Cinta con las capacidades */}
      <div className="-mx-4 mt-10 overflow-hidden border-y-[3px] border-ink bg-sun py-2.5 sm:mx-0 sm:rounded-lg sm:border-[3px]" aria-hidden="true">
        <div className="flex w-max animate-marquee gap-8 font-display text-2xl tracking-wide">
          {[...MARQUEE, ...MARQUEE].map((m, i) => <span key={i} className="flex items-center gap-8">{m}<span className="text-pop">★</span></span>)}
        </div>
      </div>

      <section className="mt-16" aria-labelledby="estilos">
        <h2 id="estilos" className="title-comic text-4xl">Cuatro estilos, un solo estudio</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.entries(STYLES) as [string, { name: string; prompt: string }][]).map(([k, s], i) => (
            <div key={k} className="frame frame-hover overflow-hidden shadow-hard">
              <div className={`halftone relative grid h-28 place-items-center border-b-[3px] border-ink ${STYLE_ART[i].bg}`}>
                <span className="rounded-md border-[3px] border-ink bg-white px-3 py-1 font-display text-2xl shadow-hard-sm">{STYLE_ART[i].tag}</span>
              </div>
              <div className="p-4">
                <h3 className="text-lg font-extrabold">{s.name}</h3>
                <p className="mt-1 text-sm text-ink/70">{STYLE_ART[i].d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16" aria-labelledby="como">
        <h2 id="como" className="title-comic text-4xl">Del guion al video en tres pasos</h2>
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
        <p className="relative mx-auto mt-2 max-w-md text-white/80">Crea tu cuenta gratis y convierte una idea en un cómic con voz y video.</p>
        <Link href={user ? "/dashboard" : "/registro"} className="btn-sun btn-shine relative mt-6 px-8 py-3 text-base">{user ? "Ir a mi biblioteca" : "Crear mi cómic"}</Link>
      </section>

      <Footer />
    </Page>
  );
}
