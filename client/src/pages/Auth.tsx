import { useState, type FormEvent } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useConfig, useMe } from "@/lib/hooks";
import { Page, ErrorNote } from "@/components/Layout";

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const isReg = mode === "register";
  const { user, loading } = useMe();
  const cfg = useConfig();
  const qc = useQueryClient();
  const [, nav] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user) return <Redirect to="/dashboard" />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api("POST", isReg ? "/api/auth/register" : "/api/auth/login", isReg ? { name, email, password } : { email, password });
      await qc.invalidateQueries({ queryKey: ["me"] });
      nav("/dashboard");
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <Page>
      <div className="mx-auto max-w-md">
        <div className="frame p-6 shadow-hard">
          <h1 className="font-display text-4xl tracking-wide">{isReg ? "Crea tu cuenta" : "Entra a tu estudio"}</h1>
          <p className="mt-1 text-sm text-ink/70">{isReg ? "Empiezas en el plan Gratis, sin tarjeta." : "Tus cómics te están esperando."}</p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            {isReg && (
              <div>
                <label className="label" htmlFor="name">Nombre</label>
                <input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
              </div>
            )}
            <div>
              <label className="label" htmlFor="email">Correo</label>
              <input id="email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </div>
            <div>
              <label className="label" htmlFor="password">Contraseña</label>
              <input id="password" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete={isReg ? "new-password" : "current-password"} minLength={isReg ? 8 : 1} required />
              {isReg && <p className="mt-1 text-xs text-ink/60">Mínimo 8 caracteres.</p>}
            </div>
            {!isReg && cfg?.mail && <p className="text-sm"><Link href="/olvide" className="font-bold underline decoration-pop decoration-2 underline-offset-2">¿Olvidaste tu contraseña?</Link></p>}
            <ErrorNote message={error} />
            <button className="btn-pop w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}{isReg ? "Crear cuenta" : "Entrar"}
            </button>
          </form>
          <p className="mt-5 text-sm">
            {isReg ? "¿Ya tienes cuenta? " : "¿Aún no tienes cuenta? "}
            <Link href={isReg ? "/login" : "/registro"} className="font-bold underline decoration-pop decoration-2 underline-offset-2">
              {isReg ? "Entrar" : "Crear una"}
            </Link>
          </p>
        </div>
      </div>
    </Page>
  );
}
