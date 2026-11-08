import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Menu, X, Plus } from "lucide-react";

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
  const { show } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);

  const logout = async () => {
    try {
      await api("POST", "/api/auth/logout");
      qc.clear();
      nav("/");
      show({ type: "success", title: "Sesión cerrada", message: "Hasta pronto." });
    } catch (e) {
      show({ type: "error", title: "Error", message: "No se pudo cerrar la sesión." });
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b-[3px] border-ink bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2">
          <Logo />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMenuOpen(true)}
              className="md:hidden rounded-lg p-2 hover:bg-ink/10"
              aria-label="Abrir menú"
            >
              <Menu className="h-6 w-6" />
            </button>
            <nav className="hidden md:flex flex-wrap items-center gap-1 text-sm font-bold sm:gap-2" aria-label="Principal">
              <NavLink href="/explorar">Explorar</NavLink>
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
            {user && (
              <Link href="/dashboard" className="hidden md:flex items-center gap-2 rounded-lg border-2 border-ink bg-white px-3 py-2 text-sm font-bold transition hover:bg-sun/50">
                <Plus className="h-4 w-4" aria-hidden /> Nuevo cómic
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Menú móvil */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white md:hidden">
          <div className="px-4 py-3 border-b border-ink/20 flex items-center justify-between">
            <Logo className="mr-2" />
            <button onClick={() => setMenuOpen(false)} className="rounded p-2 hover:bg-ink/10">
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
            <NavLink href="/precios">Precios</NavLink>
            {user ? (
              <>
                <NavLink href="/dashboard">Mi biblioteca</NavLink>
                <NavLink href="/account">Cuenta</NavLink>
                <button onClick={logout} className="w-full text-left rounded-lg px-3 py-2 text-sm font-bold transition hover:bg-sun/50">Salir</button>
              </>
            ) : (
              <>
                <NavLink href="/login">Entrar</NavLink>
                <Link href="/registro" className="w-full text-left rounded-lg border-2 border-ink bg-white px-3 py-2 text-sm font-bold transition hover:bg-sun/50">Crear cuenta</Link>
              </>
            )}
          </nav>
        </div>
      )}
    </>
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

