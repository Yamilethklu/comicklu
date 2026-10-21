import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { api, errMsg } from "@/lib/api";
import { allowNativeCheckout, openExternal } from "@/lib/native";
import { useConfig, useMe } from "@/lib/hooks";
import { Page, ErrorNote } from "@/components/Layout";
import { PLANS, METRIC_LABEL, type Metric } from "@shared/plans";

const STATUS: Record<string, string> = {
  active: "Activa", trialing: "En prueba", past_due: "Pago pendiente", canceled: "Cancelada",
  unpaid: "Sin pagar", incomplete: "Incompleta", incomplete_expired: "Expirada", paused: "En pausa",
};

export default function Account() {
  const { me, user, refetch } = useMe();
  const cfg = useConfig();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const [, nav] = useLocation();
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [delPw, setDelPw] = useState("");
  const [delOpen, setDelOpen] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("checkout") !== "success") return;
    window.history.replaceState({}, "", "/account");
    setWelcome(true);
    api("POST", "/api/billing/sync").then(() => qc.invalidateQueries({ queryKey: ["me"] })).catch((e) => setError(errMsg(e)));
  }, [qc]);

  if (!user || !me) return null;
  const plan = PLANS[me.effectivePlan ?? "free"];
  const hasSub = !!user.subscriptionStatus && user.plan !== "free";

  const portal = async () => {
    setBusy(true); setError(null);
    try { await openExternal((await api<{ url: string }>("POST", "/api/billing/portal")).url); setBusy(false); }
    catch (e) { setError(errMsg(e)); setBusy(false); }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setPwMsg(null);
    try {
      await api("POST", "/api/auth/password", { current: pw.current, password: pw.next });
      setPw({ current: "", next: "" }); setPwMsg({ ok: true, text: "Contraseña actualizada. Se cerró tu sesión en otros dispositivos." });
    } catch (err) { setPwMsg({ ok: false, text: errMsg(err) }); }
  };
  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault(); setDelError(null);
    if (!confirm("Se borrarán tu cuenta, tus cómics y tus archivos. No se puede deshacer. ¿Continuar?")) return;
    try {
      await api("DELETE", "/api/auth/account", { password: delPw });
      qc.clear(); nav("/");
    } catch (err) { setDelError(errMsg(err)); }
  };
  const liveSub = !!user.subscriptionStatus && ["active", "trialing", "past_due"].includes(user.subscriptionStatus);

  return (
    <Page>
      <h1 className="font-display text-5xl tracking-wide">Mi cuenta</h1>
      {welcome && (
        <p className="mt-4 rounded-lg border-2 border-ink bg-mint/40 px-3 py-2 text-sm font-semibold" role="status">
          ¡Pago recibido! Estamos activando tu plan{me.effectivePlan === "free" ? "; si no cambia en un minuto, recarga la página." : "."}
          <button className="ml-2 underline" onClick={() => refetch()}>Actualizar</button>
        </p>
      )}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="frame p-6" aria-labelledby="perfil">
          <h2 id="perfil" className="text-xl font-extrabold">Perfil</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div><dt className="font-bold">Nombre</dt><dd>{user.name}</dd></div>
            <div><dt className="font-bold">Correo</dt><dd>{user.email}</dd></div>
          </dl>
        </section>

        <section className="frame bg-sun/40 p-6" aria-labelledby="suscripcion">
          <h2 id="suscripcion" className="text-xl font-extrabold">Suscripción</h2>
          <p className="mt-2 font-display text-4xl tracking-wide">{plan.name}</p>
          {hasSub && (
            <ul className="mt-2 space-y-1 text-sm">
              <li>Estado: <strong>{STATUS[user.subscriptionStatus!] ?? user.subscriptionStatus}</strong></li>
              {user.currentPeriodEnd && (
                <li>{user.cancelAtPeriodEnd ? "Termina el" : "Se renueva el"} <strong>{new Date(user.currentPeriodEnd).toLocaleDateString("es", { dateStyle: "long" })}</strong></li>
              )}
              {user.cancelAtPeriodEnd && <li>Tu suscripción no se renovará. Conservas el plan hasta esa fecha.</li>}
              {user.subscriptionStatus === "past_due" && <li className="font-bold">No pudimos cobrar tu último pago. Actualiza tu método de pago para no perder el plan.</li>}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            {user.hasBilling && cfg?.stripe && allowNativeCheckout && (
              <button className="btn-pop" onClick={portal} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Administrar suscripción</button>
            )}
            {allowNativeCheckout && me.effectivePlan !== "premium" && !hasSub && <Link href="/precios" className="btn-pop">Mejorar plan</Link>}
          </div>
          <ErrorNote message={error} />
        </section>
      </div>

      <section className="frame mt-6 p-6" aria-labelledby="uso">
        <h2 id="uso" className="text-xl font-extrabold">Uso de este mes</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Meter label="Cómics guardados" used={me.comics ?? 0} limit={plan.limits.comics} />
          {(Object.keys(plan.limits.monthly) as Metric[]).map((m) => (
            <Meter key={m} label={METRIC_LABEL[m][0].toUpperCase() + METRIC_LABEL[m].slice(1)} used={me.usage?.[m] ?? 0} limit={plan.limits.monthly[m]} />
          ))}
        </div>
        <p className="mt-4 text-xs text-ink/60">Los contadores mensuales se reinician el día 1 de cada mes (UTC).</p>
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="frame p-6" aria-labelledby="clave">
          <h2 id="clave" className="text-xl font-extrabold">Cambiar contraseña</h2>
          <form onSubmit={changePassword} className="mt-3 space-y-3">
            <div>
              <label className="label" htmlFor="cur">Contraseña actual</label>
              <input id="cur" type="password" className="field" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" required />
            </div>
            <div>
              <label className="label" htmlFor="new">Contraseña nueva</label>
              <input id="new" type="password" className="field" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" minLength={8} required />
            </div>
            {pwMsg && <p role={pwMsg.ok ? "status" : "alert"} className={`rounded-lg border-2 border-ink px-3 py-2 text-sm font-semibold ${pwMsg.ok ? "bg-mint/40" : "bg-pop/15"}`}>{pwMsg.text}</p>}
            <button className="btn-pop">Guardar contraseña</button>
          </form>
        </section>

        <section className="frame p-6" aria-labelledby="borrar">
          <h2 id="borrar" className="text-xl font-extrabold">Borrar mi cuenta</h2>
          <p className="mt-1 text-sm text-ink/70">Elimina tu cuenta, tus cómics y tus archivos de forma permanente.{liveSub && " Tu suscripción activa se cancelará de inmediato."}</p>
          {!delOpen ? (
            <button className="btn-ghost mt-3" onClick={() => setDelOpen(true)}>Quiero borrar mi cuenta</button>
          ) : (
            <form onSubmit={deleteAccount} className="mt-3 space-y-3">
              <div>
                <label className="label" htmlFor="delpw">Escribe tu contraseña para confirmar</label>
                <input id="delpw" type="password" className="field" value={delPw} onChange={(e) => setDelPw(e.target.value)} autoComplete="current-password" required />
              </div>
              <ErrorNote message={delError} />
              <div className="flex gap-2">
                <button className="btn-pop" disabled={!delPw}>Borrar definitivamente</button>
                <button type="button" className="btn-ghost" onClick={() => { setDelOpen(false); setDelPw(""); setDelError(null); }}>Cancelar</button>
              </div>
            </form>
          )}
        </section>
      </div>
    </Page>
  );
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit === 0 ? 0 : Math.min(100, (used / limit) * 100);
  return (
    <div>
      <div className="flex justify-between text-sm font-bold"><span>{label}</span><span>{limit === 0 ? "No incluido" : `${used} / ${limit}`}</span></div>
      <div className="mt-1 h-3 overflow-hidden rounded-full border-2 border-ink bg-white" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit} aria-label={label}>
        <div className={`h-full ${pct >= 100 ? "bg-pop" : "bg-zap"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
