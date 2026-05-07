import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, isOverdue } from "@/lib/task-utils";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_app/tasks/")({
  validateSearch: (s: Record<string, unknown>) => ({ filter: (s.filter as string) || "all" }),
  component: TasksList,
});

function TasksList() {
  const { role, user } = useAuth();
  const search = Route.useSearch();
  const [tasks, setTasks] = useState<any[]>([]);
  const [filter, setFilter] = useState(search.filter);
  const [q, setQ] = useState("");

  useEffect(() => {
    let query = supabase.from("tasks").select("*, projects(name), profiles:assigned_to(full_name)").order("created_at", { ascending: false });
    if (role !== "team_lead" && user) query = query.eq("assigned_to", user.id);
    query.then(({ data }) => setTasks(data ?? []));
  }, [role, user]);

  const filtered = tasks
    .filter(t => filter === "all" ? true : filter === "overdue" ? isOverdue(t.due_date, t.status) : t.status === filter)
    .filter(t => !q || t.title.toLowerCase().includes(q.toLowerCase()));

  const filters = ["all","not_started","in_progress","pending_review","verified_completed","needs_rework","overdue"];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Tasks</h1>
        {role === "team_lead" && (
          <Link to="/tasks/new" className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium">
            <Plus className="size-4" />New Task
          </Link>
        )}
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." className="border rounded px-3 py-1.5 bg-background text-sm" />
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`text-xs px-3 py-1.5 rounded border ${filter===f ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}>
            {f === "all" ? "All" : f === "overdue" ? "Overdue" : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        {filtered.length === 0 ? <div className="p-10 text-center text-muted-foreground text-sm">No tasks found.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr><th className="p-3">Title</th><th>Project</th><th>Assignee</th><th>Priority</th><th>Status</th><th>Due</th></tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-t hover:bg-accent/30">
                    <td className="p-3"><Link to="/tasks/$id" params={{ id: t.id }} className="font-medium hover:underline">{t.title}</Link></td>
                    <td>{t.projects?.name}</td>
                    <td>{t.profiles?.full_name ?? "—"}</td>
                    <td><span className={`text-xs px-2 py-0.5 rounded ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span></td>
                    <td><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[t.status]}`}>{STATUS_LABELS[t.status]}</span></td>
                    <td className={isOverdue(t.due_date, t.status) ? "text-destructive font-medium" : ""}>
                      {t.due_date ? new Date(t.due_date).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
