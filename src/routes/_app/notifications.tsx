import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Bell, CheckCheck } from "lucide-react";

export const Route = createFileRoute("/_app/notifications")({ component: Notifs });

function Notifs() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, [user]);

  const markAll = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    load();
  };

  const markOne = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    load();
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Bell className="size-5" />Notifications</h1>
        <button onClick={markAll} className="text-sm inline-flex items-center gap-1 text-primary"><CheckCheck className="size-4" />Mark all read</button>
      </div>
      <div className="bg-card border rounded-lg divide-y">
        {items.length === 0 ? <div className="p-8 text-center text-muted-foreground text-sm">No notifications.</div> : items.map(n => (
          <div key={n.id} className={`p-4 flex items-start justify-between gap-3 ${!n.is_read ? "bg-accent/30" : ""}`}>
            <div>
              <div className="font-medium text-sm">{n.title}</div>
              <div className="text-sm text-muted-foreground">{n.message}</div>
              <div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
              {n.link && <Link to={n.link} className="text-xs text-primary hover:underline">View →</Link>}
            </div>
            {!n.is_read && <button onClick={() => markOne(n.id)} className="text-xs text-primary">Mark read</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
