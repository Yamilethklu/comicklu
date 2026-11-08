import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Page } from "@/components/Layout";
import { api, errMsg } from "@/lib/api";
import { useMe } from "@/lib/hooks";

type Summary = {
  registered:number; newUsers30d:number; plans:{free:number;pro:number;premium:number};
  comics:number; pdfSales:number; pdfGrossCents:number; subscriptionGross30dCents:number|null;
  invoicesTruncated:boolean; pendingFeedback:number;
  recentUsers:{id:string;name:string;email:string;plan:string;effectivePlan:string;status:string|null;periodEnd:string|null;joined:string}[];
};
type Review = {id:number;name:string;rating:number;comment:string;status:string;adminReply:string|null;createdAt:string};
const usd=(n:number)=>new Intl.NumberFormat("es-MX",{style:"currency",currency:"USD"}).format(n/100);

function Moderate({item,done}:{item:Review;done:()=>void}) {
  const [reply,setReply]=useState(item.adminReply??""); const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const act=async(status:"approved"|"rejected")=>{
    setBusy(true);setError("");
    try{await api("PATCH",`/api/admin/feedback/${item.id}`,{status,adminReply:reply});done();}
    catch(e){setError(errMsg(e))}
    finally{setBusy(false)}
  };
  return <article className="frame bg-white p-4">
    <div className="flex flex-wrap justify-between gap-2"><strong>{item.name} · {item.rating}/5</strong><span className="text-sm">Estado: {item.status}</span></div>
    <p className="my-3 whitespace-pre-wrap break-words">{item.comment}</p>
    <label className="label" htmlFor={`reply-${item.id}`}>Respuesta pública opcional</label>
    <textarea className="field min-h-20" id={`reply-${item.id}`} maxLength={1000} value={reply} onChange={e=>setReply(e.target.value)}/>
    <div className="mt-3 flex gap-2"><button className="btn-sun" onClick={()=>act("approved")} disabled={busy}>Aprobar</button>
      <button className="btn-ghost" onClick={()=>act("rejected")} disabled={busy}>Rechazar/ocultar</button></div>
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
  </article>;
}

export default function Administracion() {
  const {user}=useMe();const qc=useQueryClient();
  const summary=useQuery({queryKey:["admin-summary"],queryFn:()=>api<Summary>("GET","/api/admin/summary"),enabled:!!user});
  const feedback=useQuery({queryKey:["admin-feedback"],queryFn:()=>api<Review[]>("GET","/api/admin/feedback"),enabled:!!user});
  if(user?.role!=="admin")return <Page><p role="alert">Este espacio está reservado para administración.</p></Page>;
  const s=summary.data;
  return <Page wide>
    <h1 className="title-comic text-5xl">Administración ComicKlu</h1>
    <p className="mt-2 text-sm text-ink/70">Panel privado: accesible únicamente con una cuenta autorizada por el servidor.</p>
    {summary.isError && <p className="mt-5" role="alert">No se pudo abrir el panel: {errMsg(summary.error)}. Revisa el rol y ADMIN_EMAILS en Vercel.</p>}
    {summary.isLoading && <p className="mt-5">Cargando estadísticas…</p>}
    {s && <>
      <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Usuarios registrados",s.registered],["Nuevos últimos 30 días",s.newUsers30d],
          ["Suscriptores Pro",s.plans.pro],["Suscriptores Premium",s.plans.premium],
          ["Usuarios Gratis",s.plans.free],["Historietas creadas",s.comics],
          ["Ventas PDF",s.pdfSales],["Opiniones pendientes",s.pendingFeedback]
        ].map(([title,value])=><div key={title} className="frame bg-white p-4"><p className="text-sm text-ink/70">{title}</p><p className="mt-2 text-3xl font-extrabold">{value}</p></div>)}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="frame bg-sun/25 p-5">
          <h2 className="text-lg font-extrabold">Cobros de suscripciones · últimos 30 días</h2>
          <p className="mt-2 text-3xl font-bold">{s.subscriptionGross30dCents===null?"No disponible":usd(s.subscriptionGross30dCents)}</p>
          <p className="mt-2 text-xs">Cobros brutos pagados del catálogo ComicKlu consultados a Stripe. No es ganancia neta ni saldo disponible.
            {s.invoicesTruncated?" Stripe devolvió solo una parte de las facturas; cifra parcial.":""}</p>
        </section>
        <section className="frame bg-white p-5"><h2 className="text-lg font-extrabold">Ingresos brutos por PDF registrados</h2>
          <p className="mt-2 text-3xl font-bold">{usd(s.pdfGrossCents)}</p>
          <p className="mt-2 text-xs">Acumulado de pagos PDF registrados; antes de impuestos, comisiones, reembolsos y costos de IA. Las ganancias netas requieren registrar esos gastos.</p>
        </section>
      </div>
      <section className="frame mt-6 overflow-x-auto p-5">
        <h2 className="text-xl font-extrabold">Últimas cuentas y suscripciones</h2>
        <table className="mt-4 w-full min-w-[660px] text-left text-sm"><thead><tr className="border-b-2 border-ink">
          <th className="p-2">Nombre</th><th className="p-2">Correo</th><th className="p-2">Plan efectivo</th><th className="p-2">Stripe</th><th className="p-2">Vigencia</th></tr></thead>
          <tbody>{s.recentUsers.map(u=><tr key={u.id} className="border-b border-ink/20"><td className="p-2">{u.name}</td><td className="p-2">{u.email}</td>
          <td className="p-2">{u.effectivePlan}</td><td className="p-2">{u.status??"—"}</td><td className="p-2">{u.periodEnd?new Date(u.periodEnd).toLocaleDateString("es-MX"):"—"}</td></tr>)}</tbody>
        </table>
        <p className="mt-3 text-xs text-ink/60">Se muestran las 75 cuentas más recientes; el resumen superior incluye todas.</p>
      </section>
    </>}
    <section className="mt-7">
      <h2 className="text-2xl font-extrabold">Moderar opiniones del sitio</h2>
      {feedback.isError && <p role="alert">Error cargando opiniones: {errMsg(feedback.error)}</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-2">{feedback.data?.map(x=><Moderate key={x.id} item={x}
        done={()=>{void qc.invalidateQueries({queryKey:["admin-feedback"]});void qc.invalidateQueries({queryKey:["admin-summary"]});}}/>)}</div>
      {feedback.data?.length===0 && <p className="mt-3">No hay opiniones todavía.</p>}
    </section>
  </Page>;
}
