import { Link } from "wouter";
import { Page } from "@/components/Layout";
import { useConfig, useMe } from "@/lib/hooks";
import { STYLES } from "@shared/plans";
import { PlanCards } from "./Pricing";

function HeroPage() {
  // Una página de cómic hecha con CSS: el primer vistazo ya es una viñeta.
  return (
    <div className="frame grid aspect-[4/5] w-full max-w-[460px] grid-cols-6 grid-rows-6 gap-2 bg-ink p-2 shadow-hard rotate-1" aria-hidden="true">
      <div className="relative col-span-4 row-span-3 overflow-hidden rounded-md border-[3px] border-ink bg-zap">
        <div className="halftone absolute inset-0 opacity-20" />
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-ink/80" />
        <div className="absolute bottom-3 left-4 right-4 h-3 rounded-full bg-sun" />
        <div className="absolute left-5 top-5 rounded-lg border-[3px] border-ink bg-white px-3 py-2 font-display text-lg leading-tight">
          ¡La ciudad<br />no duerme!
        </div>
      </div>
      <div className="relative col-span-2 row-span-2 overflow-hidden rounded-md border-[3px] border-ink bg-pop">
        <div className="halftone absolute inset-0 opacity-25" />
        <div className="absolute inset-0 grid place-items-center font-display text-5xl text-white drop-shadow-[3px_3px_0_#16132b]">ZAP</div>
      </div>
      <div className="relative col-span-2 row-span-1 rounded-md border-[3px] border-ink bg-sun" />
      <div className="relative col-span-3 row-span-3 overflow-hidden rounded-md border-[3px] border-ink bg-mint">
        <div className="absolute -bottom-6 left-6 h-28 w-28 rounded-full border-[3px] border-ink bg-white" />
        <div className="absolute right-3 top-3 rounded-md border-[3px] border-ink bg-white px-2 py-1 text-xs font-extrabold">Capítulo 1</div>
      </div>
      <div className="relative col-span-3 row-span-3 overflow-hidden rounded-md border-[3px] border-ink bg-white">
        <div className="halftone absolute inset-0 opacity-30" />
        <div className="absolute bottom-4 left-4 right-4 rounded-[50%] border-[3px] border-ink bg-white px-4 py-3 text-center text-sm font-extrabold">
          Pon voz a tu historia
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { t: "Escribe o deja que la IA te ayude", d: "Cuenta tu idea y obtén un guion dividido en viñetas con narración y diálogos." },
  { t: "Dale imagen a cada viñeta", d: "Genera la ilustración con IA, sube la tuya o pega un enlace." },
  { t: "Agrega voz y exporta", d: "Narra con voces de IA y descarga un video animado o la ficha del proyecto." },
];

export default function Landing() {
  const { user } = useMe();
  const cfg = useConfig();
  return (
    <Page>
      <section className="grid items-center gap-10 py-6 md:grid-cols-2">
        <div>
          <h1 className="font-display text-6xl leading-[0.95] tracking-wide md:text-7xl">
            Tu historia,<br />viñeta por viñeta
          </h1>
          <p className="mt-5 max-w-lg text-lg text-ink/80">
            Panelforge es un estudio para crear cómics, manga, anime y cyberpunk. Escribe el guion, genera las imágenes con IA,
            ponles voz y llévalas a video.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={user ? "/dashboard" : "/registro"} className="btn-pop px-6 py-3 text-base">{user ? "Ir a mi biblioteca" : "Empezar gratis"}</Link>
            <Link href="/precios" className="btn-ghost px-6 py-3 text-base">Ver planes</Link>
          </div>
        </div>
        <div className="flex justify-center md:justify-end"><HeroPage /></div>
      </section>

      <section className="mt-16" aria-labelledby="estilos">
        <h2 id="estilos" className="font-display text-4xl tracking-wide">Cuatro estilos, un solo estudio</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.entries(STYLES) as [string, { name: string; prompt: string }][]).map(([k, s], i) => (
            <div key={k} className="frame overflow-hidden shadow-hard">
              <div className={`halftone h-24 border-b-[3px] border-ink ${["bg-sun", "bg-white", "bg-pop/80", "bg-zap"][i]}`} />
              <div className="p-4">
                <h3 className="text-lg font-extrabold">{s.name}</h3>
                <p className="mt-1 text-sm text-ink/70">
                  {["Contornos gruesos, color plano y puntos de trama.", "Blanco y negro con tramas y mucha expresión.", "Colores vivos y sombreado limpio de animación.", "Neón, lluvia y ciudades que nunca apagan sus luces."][i]}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16" aria-labelledby="como">
        <h2 id="como" className="font-display text-4xl tracking-wide">Del guion al video en tres pasos</h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.t} className="frame p-5">
              <span className="grid h-9 w-9 place-items-center rounded-full border-[3px] border-ink bg-sun font-display text-xl">{i + 1}</span>
              <h3 className="mt-3 text-lg font-extrabold">{s.t}</h3>
              <p className="mt-1 text-sm text-ink/70">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {cfg && (
        <section className="mt-16" aria-labelledby="planes">
          <h2 id="planes" className="font-display text-4xl tracking-wide">Empieza gratis, crece cuando quieras</h2>
          <div className="mt-5"><PlanCards compact /></div>
        </section>
      )}

      <footer className="mt-20 border-t-[3px] border-ink pt-6 text-sm text-ink/70">
        © {new Date().getFullYear()} Panelforge. Los pagos se procesan con Stripe; nunca vemos los datos de tu tarjeta.
      </footer>
    </Page>
  );
}
