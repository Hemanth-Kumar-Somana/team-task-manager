import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABELS, isOverdue } from "@/lib/task-utils";

export const Route = createFileRoute("/_app/reports")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle();
    if (data?.role !== "team_lead") throw redirect({ to: "/member" });
  },
  component: Reports,
});

function Reports() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const [pj, tk] = await Promise.all([
        supabase.from("projects").select("id,name, tasks(id,status,due_date)"),
        supabase.from("tasks").select("status,due_date"),
      ]);
      setData({ projects: pj.data ?? [], tasks: tk.data ?? [] });
    };
    load();
  }, []);

  if (!data) return <div className="text-muted-foreground">Loading…</div>;

  const statusCounts: Record<string, number> = {};
  ["not_started","in_progress","pending_review","verified_completed","needs_rework"].forEach(s => statusCounts[s] = 0);
  data.tasks.forEach((t: any) => { statusCounts[t.status] = (statusCounts[t.status] || 0) + 1; });
  const overdue = data.tasks.filter((t: any) => isOverdue(t.due_date, t.status)).length;
  const total = data.tasks.length || 1;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <div className="bg-card border rounded-lg p-5">
        <h2 className="font-semibold mb-4">Tasks by Status</h2>
        <div className="space-y-2">
          {Object.entries(statusCounts).map(([s, c]) => (
            <div key={s}>
              <div className="flex justify-between text-sm"><span>{STATUS_LABELS[s]}</span><span className="text-muted-foreground">{c}</span></div>
              <div className="h-2 bg-muted rounded overflow-hidden mt-1"><div className="h-full bg-primary" style={{ width: `${(c/total)*100}%` }} /></div>
            </div>
          ))}
          <div className="pt-2">
            <div className="flex justify-between text-sm"><span className="text-destructive">Overdue</span><span className="text-muted-foreground">{overdue}</span></div>
            <div className="h-2 bg-muted rounded overflow-hidden mt-1"><div className="h-full bg-destructive" style={{ width: `${(overdue/total)*100}%` }} /></div>
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-5">
        <h2 className="font-semibold mb-4">Project Completion</h2>
        <div className="space-y-3">
          {data.projects.map((p: any) => {
            const t = p.tasks?.length ?? 0;
            const d = p.tasks?.filter((x: any) => x.status === "verified_completed").length ?? 0;
            const pct = t ? Math.round((d/t)*100) : 0;
            return (
              <div key={p.id}>
                <div className="flex justify-between text-sm"><span className="font-medium">{p.name}</span><span className="text-muted-foreground">{d}/{t} • {pct}%</span></div>
                <div className="h-2 bg-muted rounded overflow-hidden mt-1"><div className="h-full bg-success" style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
          {data.projects.length === 0 && <p className="text-sm text-muted-foreground">No projects yet.</p>}
        </div>
      </div>
    </div>
  );
}
