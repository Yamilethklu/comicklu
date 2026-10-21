import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useConfig } from "@/lib/hooks";
import { Page, ErrorNote } from "@/components/Layout";

export function ForgotPassword() {
  const cfg = useConfig();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await api("POST", "/api/auth/forgot", { email }); setSent(true); }
    catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <Page>
      <div className="mx-auto max-w-md">
        <div className="frame p-6 shadow-hard">
          <h1 className="font-display text-4xl tracking-wide">Recupera tu contraseña</h1>
          {cfg && !cfg.mail ? (
            <p className="mt-3 text-sm">La recuperación por correo no está activada en este servidor. Contacta al administrador.</p>
          ) : sent ? (
            <p role="status" className="mt-3 rounded-lg border-2 border-ink bg-mint/40 px-3 py-2 text-sm font-semibold">
              Si ese correo tiene una cuenta, te enviamos un enlace para elegir una contraseña nueva. Revisa también la carpeta de spam.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-4">
              <div>
                <label className="label" htmlFor="email">Correo de tu cuenta</label>
                <input id="email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              </div>
              <ErrorNote message={error} />
              <button className="btn-pop w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Enviar enlace</button>
            </form>
          )}
          <p className="mt-5 text-sm"><Link href="/login" className="font-bold underline decoration-pop decoration-2 underline-offset-2">Volver a entrar</Link></p>
        </div>
      </div>
    </Page>
  );
}

export function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await api("POST", "/api/auth/reset", { token, password }); setDone(true); }
    catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <Page>
      <div className="mx-auto max-w-md">
        <div className="frame p-6 shadow-hard">
          <h1 className="font-display text-4xl tracking-wide">Nueva contraseña</h1>
          {!token ? (
            <p className="mt-3 text-sm">Este enlace no es válido. <Link href="/olvide" className="font-bold underline">Pide uno nuevo</Link>.</p>
          ) : done ? (
            <>
              <p role="status" className="mt-3 rounded-lg border-2 border-ink bg-mint/40 px-3 py-2 text-sm font-semibold">Listo, tu contraseña cambió. Ya puedes entrar.</p>
              <Link href="/login" className="btn-pop mt-4">Entrar</Link>
            </>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-4">
              <div>
                <label className="label" htmlFor="pw">Contraseña nueva</label>
                <input id="pw" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
                <p className="mt-1 text-xs text-ink/60">Mínimo 8 caracteres.</p>
              </div>
              <ErrorNote message={error} />
              <button className="btn-pop w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Guardar contraseña</button>
            </form>
          )}
        </div>
      </div>
    </Page>
  );
}
