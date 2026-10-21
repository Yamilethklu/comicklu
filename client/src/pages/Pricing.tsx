import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Check, Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { allowNativeCheckout, openExternal } from "@/lib/native";
import { useConfig, useMe } from "@/lib/hooks";
import { Page, ErrorNote } from "@/components/Layout";
import type { PlanId } from "@shared/plans";

export function PlanCards({ compact }: { compact?: boolean }) {
  const cfg = useConfig();
  const { me, user } = useMe();
  const [, nav] = useLocation();
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!cfg) return null;

  const current: PlanId = me?.effectivePlan ?? "free";
  const hasSub = !!user && !!user.subscriptionStatus && ["active", "trialing", "past_due"].includes(user.subscriptionStatus);
  const yearlyAvailable = cfg.yearly.pro && cfg.yearly.premium;

  const go = async (plan: "pro" | "premium") => {
    if (!user) return nav("/registro");
    setBusy(plan); setError(null);
    try {
      if (hasSub) {
        const { url } = await api<{ url: string }>("POST", "/api/billing/portal");
        await openExternal(url);
      } else {
        const { url } = await api<{ url: string }>("POST", "/api/billing/checkout", { plan, interval });
        await openExternal(url);
      }
    } catch (e) { setError(errMsg(e)); setBusy(null); }
  };

  return (
    <div>
      {yearlyAvailable && (
        <div className="mb-5 inline-flex rounded-lg border-[3px] border-ink bg-white p-1" role="group" aria-label="Periodo de facturación">
          {(["month", "year"] as const).map((i) => (
            <button key={i} onClick={() => setInterval(i)} aria-pressed={interval === i}
              className={`rounded-md px-4 py-1.5 text-sm font-bold ${interval === i ? "bg-ink text-white" : ""}`}>
              {i === "month" ? "Mensual" : "Anual"}
            </button>
          ))}
        </div>
      )}
      <ErrorNote message={error} />
      <div className="mt-2 grid gap-5 md:grid-cols-3">
        {(Object.values(cfg.plans)).map((p) => {
          const featured = p.id === "pro";
          const price = interval === "year" && yearlyAvailable ? p.priceYear : p.priceMonth;
          const isCurrent = user ? current === p.id : false;
          return (
            <div key={p.id} className={`frame flex flex-col p-6 ${featured ? "bg-sun shadow-hard md:-translate-y-2" : ""}`}>
              <h3 className="font-display text-3xl tracking-wide">{p.name}</h3>
              <p className="text-sm text-ink/70">{p.tagline}</p>
              <p className="mt-4">
                <span className="text-4xl font-extrabold">{price === 0 ? "$0" : `$${price}`}</span>
                <span className="ml-1 text-sm text-ink/70">{price === 0 ? "para siempre" : interval === "year" && yearlyAvailable ? "USD al año" : "USD al mes"}</span>
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{f}</li>
                ))}
              </ul>
              <div className="mt-6">
                {p.id === "free" ? (
                  isCurrent ? <button className="btn-ghost w-full" disabled>Tu plan actual</button>
                    : <Link href={user ? "/dashboard" : "/registro"} className="btn-ghost w-full">{user ? "Ir a mi biblioteca" : "Empezar gratis"}</Link>
                ) : isCurrent ? (
                  <button className="btn-ghost w-full" disabled>Tu plan actual</button>
                ) : !allowNativeCheckout ? (
                  <p className="text-center text-xs text-ink/70">Disponible en la versión web de Panelforge.</p>
                ) : (
                  <button className={featured ? "btn-pop w-full" : "btn-sun w-full"} disabled={!cfg.stripe || busy !== null} onClick={() => go(p.id as "pro" | "premium")}>
                    {busy === p.id && <Loader2 className="h-4 w-4 animate-spin" />}
                    {!cfg.stripe ? "Pagos no disponibles aún" : hasSub ? "Cambiar de plan" : `Elegir ${p.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!compact && allowNativeCheckout && <p className="mt-4 text-xs text-ink/60">Los precios son en USD y pueden incluir impuestos según tu país. El cobro lo gestiona Stripe.</p>}
    </div>
  );
}

export default function Pricing() {
  const cancelled = new URLSearchParams(window.location.search).get("checkout") === "cancelled";
  return (
    <Page>
      <h1 className="font-display text-5xl tracking-wide">Elige tu plan</h1>
      <p className="mt-2 max-w-xl text-ink/80">Cambia o cancela cuando quieras desde tu cuenta. Si cancelas, conservas tus cómics y vuelves al plan Gratis al terminar el periodo pagado.</p>
      {cancelled && <p className="mt-4 rounded-lg border-2 border-ink bg-sun/40 px-3 py-2 text-sm font-semibold">El pago se canceló y no se hizo ningún cobro.</p>}
      <div className="mt-8"><PlanCards /></div>
    </Page>
  );
}
