import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Bell, X, CheckCircle, Clock } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Page, ErrorNote } from "@/components/Layout";
import { SkeletonText } from "@/components/Skeleton";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { show } = useToast();

  const { data: notifications = [], isLoading, error, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<Array<any>>("GET", "/api/notifications"),
  });
  const { data: unread } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => api<{ unreadCount: number }>("GET", "/api/notifications/unread-count"),
    staleTime: 30_000,
  });

  const markAllRead = async () => {
    try {
      await api("POST", "/api/notifications/read-all");
      refetch();
      show({ type: "success", title: "Todas leídas", message: "Ya no tienes notificaciones nuevas." });
    } catch (e) {
      show({ type: "error", title: "Error", message: errMsg(e) });
    }
  };

  if (error) return <p className="text-sm text-ink/70">{errMsg(error)}</p>;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg border-2 border-ink bg-white p-2 transition hover:bg-sun/50"
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5" />
        {unread && unread.unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-ink bg-pop text-white text-[10px] font-extrabold">
            {unread.unreadCount > 99 ? "99+" : unread.unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-50 w-80 rounded-lg border-[3px] border-ink bg-white shadow-hard-lg">
            <div className="flex items-center justify-between border-b-[3px] border-ink px-4 py-3">
              <h2 className="font-display text-lg">Notificaciones</h2>
              {notifications.some((n: any) => !n.read) && (
                <button onClick={markAllRead} className="text-xs font-bold text-pop underline">Marcar todas leídas</button>
              )}
            </div>
            {isLoading ? (
              <div className="p-4"><SkeletonText lines={4} /></div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-ink/60">Sin notificaciones</div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {notifications.map((n: any) => (
                  <div
                    key={n.id}
                    className={`flex gap-3 border-b border-ink/10 px-4 py-3 ${!n.read ? "bg-zap/5" : ""}`}
                  >
                    <div className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full ${!n.read ? "bg-zap/20 text-zap" : "bg-ink/5 text-ink/50"}`}>
                      {!n.read ? <Clock className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{n.title}</p>
                      <p className="text-xs text-ink/60 mt-0.5 line-clamp-2">{n.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}