import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, errMsg } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Page, ErrorNote } from "@/components/Layout";
import { Bell, Clock, CheckCircle } from "lucide-react";

export default function Notifications() {
  const { show } = useToast();
  const [filter, setFilter] = useState<"all" | "unread">("unread");

  const { data: notifications = [], isLoading, error, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<Array<any>>("GET", "/api/notifications"),
  });

  const markAllRead = async () => {
    try {
      await api("POST", "/api/notifications/read-all");
      refetch();
      show({ type: "success", title: "Todas leídas" });
    } catch (e) {
      show({ type: "error", title: "Error", message: errMsg(e) });
    }
  };

  const filtered = filter === "unread" ? notifications.filter((n: any) => !n.read) : notifications;

  if (error) return <Page><ErrorNote message={errMsg(error)} /></Page>;

  return (
    <Page>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="title-comic text-5xl">Notificaciones</h1>
        {notifications.some((n: any) => !n.read) && (
          <button onClick={markAllRead} className="btn-pop">Marcar todas leídas</button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3"><div className="h-4 rounded bg-white animate-pulse" /><div className="h-4 rounded bg-white animate-pulse" /></div>
      ) : filtered.length === 0 ? (
        <div className="frame halftone-soft p-16 text-center">
          <Bell className="mx-auto h-16 w-16 text-ink/30" />
          <h2 className="mt-4 font-display text-3xl tracking-wide">No hay notificaciones</h2>
          <p className="mt-2 text-sm text-ink/70">Cuando alguien te guste, comente o te siga, aquí verás la notificación.</p>
        </div>
      ) : (
        <ul className="mt-8 space-y-2">
          {filtered.map((n: any) => (
            <li key={n.id} className={`frame px-4 py-3 ${!n.read ? "bg-zap/5" : ""}`}>
              <div className="flex items-start gap-3">
                <div className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full ${!n.read ? "bg-zap/20 text-zap" : "bg-ink/5 text-ink/40"}`}>
                  {!n.read ? <Clock className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                </div>
                <div className="flex-1">
                  <p className="font-bold">{n.title}</p>
                  <p className="text-sm text-ink/70 mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-xs text-ink/40 mt-1">{new Date(n.createdAt).toLocaleString("es")}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold border-2 transition ${filter === "all" ? "bg-ink text-white" : "border-ink"}`}
        >
          Todas
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold border-2 transition ${filter === "unread" ? "bg-ink text-white" : "border-ink"}`}
        >
          No leídas
        </button>
      </div>
    </Page>
  );
}