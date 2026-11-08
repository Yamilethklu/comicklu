import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMe } from "@/lib/hooks";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-2 ${className}`} aria-label="Panelforge, inicio">
      <span className="grid h-9 w-9 -rotate-6 place-items-center rounded-md border-[3px] border-ink bg-sun font-display text-xl leading-none shadow-hard-sm transition group-hover:rotate-6 group-hover:bg-pop group-hover:text-white">P</span>
      <span className="font-display text-2xl tracking-wide">Panelforge</span>
    </Link>
  );
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const [loc] = useLocation();
  const active = loc === href || (href !== "/" && loc.startsWith(href));
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={`rounded-md px-3 py-2 transition hover:bg-sun/40 ${active ? "bg-sun shadow-hard-sm ring-2 ring-ink" : ""}`}>
      {children}
    </Link>
  );
}

export function Nav() {
  const { user } = useMe();
  const qc = useQueryClient();
  const [, nav] = useLocation();
  const logout = async () => {
    await api("POST", "/api/auth/logout");
    qc.clear();
    nav("/");
  };
  return (
    <header className="sticky top-0 z-40 border-b-[3px] border-ink bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2">
        <Logo />
        <nav className="flex flex-wrap items-center gap-1 text-sm font-bold sm:gap-2" aria-label="Principal">
          <NavLink href="/precios">Precios</NavLink>
          {user ? (
            <>
              <NavLink href="/dashboard">Mi biblioteca</NavLink>
              <NavLink href="/account">Cuenta</NavLink>
              <button onClick={logout} className="btn-ghost">Salir</button>
            </>
          ) : (
            <>
              <NavLink href="/login">Entrar</NavLink>
              <Link href="/registro" className="btn-pop btn-shine">Crear cuenta</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-20 border-t-[3px] border-ink pt-6 pb-4 text-sm text-ink/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Logo />
        <p>© {new Date().getFullYear()} Panelforge. Los pagos se procesan con Stripe; nunca vemos los datos de tu tarjeta.</p>
      </div>
    </footer>
  );
}

export function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className={`mx-auto animate-pop px-4 py-8 ${wide ? "max-w-7xl" : "max-w-6xl"}`}>{children}</main>
    </div>
  );
}

export function ErrorNote({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-lg border-2 border-ink bg-pop/15 px-3 py-2 text-sm font-semibold">{message}</p>;
}
