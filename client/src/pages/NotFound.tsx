import { Link } from "wouter";
import { Page } from "@/components/Layout";

export default function NotFound() {
  return (
    <Page>
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="font-display text-8xl text-pop">404</p>
        <h1 className="mt-2 text-2xl font-extrabold">Esta página no existe</h1>
        <p className="mt-2 text-ink/70">Puede que el enlace esté mal escrito o que la página se haya movido.</p>
        <Link href="/" className="btn-sun mt-6">Volver al inicio</Link>
      </div>
    </Page>
  );
}
