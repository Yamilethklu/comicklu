import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMe } from "@/lib/hooks";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 ${className}`} aria-label="Panelforge, inicio">
      <span className="grid h-9 w-9 -rotate-6 place-items-center rounded-md border-[3px] border-ink bg-sun font-display text-xl leading-none shadow-hard-sm">P</span>
      <span className="font-display text-2xl tracking-wide">Panelforge</span>
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
    <header className="border-b-[3px] border-ink bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Logo />
        <nav className="flex items-center gap-2 text-sm font-bold" aria-label="Principal">
          <Link href="/precios" className="rounded-md px-3 py-2 hover:bg-ink/5">Precios</Link>
          {user ? (
            <>
              <Link href="/dashboard" className="rounded-md px-3 py-2 hover:bg-ink/5">Mi biblioteca</Link>
              <Link href="/account" className="rounded-md px-3 py-2 hover:bg-ink/5">Cuenta</Link>
              <button onClick={logout} className="btn-ghost">Salir</button>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-md px-3 py-2 hover:bg-ink/5">Entrar</Link>
              <Link href="/registro" className="btn-pop">Crear cuenta</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className={`mx-auto px-4 py-8 ${wide ? "max-w-7xl" : "max-w-6xl"}`}>{children}</main>
    </div>
  );
}

export function ErrorNote({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-lg border-2 border-ink bg-pop/15 px-3 py-2 text-sm font-semibold">{message}</p>;
}
