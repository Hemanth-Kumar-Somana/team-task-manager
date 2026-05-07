import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ListChecks, Clock, CheckCircle2, RefreshCw, Calendar } from "lucide-react";
import { STATUS_COLORS, STATUS_LABELS, isOverdue } from "@/lib/task-utils";

export const Route = createFileRoute("/_app/member")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
  },
  component: MemberDashboard,
});

function MemberDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("tasks").select("*, projects(name)").eq("assigned_to", user.id).order("due_date", { ascending: true })
      .then(({ data }) => setTasks(data ?? []));
  }, [user]);

  const counts = {
    assigned: tasks.length,
    in_progress: tasks.filter(t => t.status === "in_progress").length,
    pending: tasks.filter(t => t.status === "pending_review").length,
    verified: tasks.filter(t => t.status === "verified_completed").length,
    rework: tasks.filter(t => t.status === "needs_rework").length,
  };
  const upcoming = tasks.filter(t => t.due_date && t.status !== "verified_completed").slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Dashboard</h1>
        <p className="text-muted-foreground text-sm">Your assigned tasks and deadlines.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat icon={<ListChecks />} label="Assigned" value={counts.assigned} />
        <Stat icon={<Clock />} label="In Progress" value={counts.in_progress} tone="info" />
        <Stat icon={<Clock />} label="Pending Review" value={counts.pending} tone="warning" />
        <Stat icon={<CheckCircle2 />} label="Verified" value={counts.verified} tone="success" />
        <Stat icon={<RefreshCw />} label="Needs Rework" value={counts.rework} tone="destructive" />
      </div>

      <div className="bg-card border rounded-lg p-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Calendar className="size-4" />Upcoming Deadlines</h2>
        {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">No upcoming deadlines.</p> : (
          <ul className="space-y-2">
            {upcoming.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm border-b last:border-b-0 pb-2">
                <div>
                  <Link to="/tasks/$id" params={{ id: t.id }} className="font-medium hover:underline">{t.title}</Link>
                  <div className="text-xs text-muted-foreground">{t.projects?.name}</div>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                  <div className={`text-xs mt-1 ${isOverdue(t.due_date, t.status) ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {isOverdue(t.due_date, t.status) ? "Overdue " : ""}{new Date(t.due_date).toLocaleDateString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-card border rounded-lg p-5">
        <h2 className="font-semibold mb-3">All My Tasks</h2>
        {tasks.length === 0 ? <p className="text-sm text-muted-foreground">No tasks assigned.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground"><tr><th className="py-2">Task</th><th>Project</th><th>Status</th><th>Due</th></tr></thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="py-2"><Link to="/tasks/$id" params={{ id: t.id }} className="font-medium hover:underline">{t.title}</Link></td>
                    <td>{t.projects?.name}</td>
                    <td><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[t.status]}`}>{STATUS_LABELS[t.status]}</span></td>
                    <td className={isOverdue(t.due_date, t.status) ? "text-destructive" : ""}>{t.due_date ? new Date(t.due_date).toLocaleDateString() : "—"}</td>
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

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: "warning" | "success" | "destructive" | "info" }) {
  const colors = tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : tone === "info" ? "text-info" : "text-primary";
  return (
    <div className="bg-card border rounded-lg p-4">
      <div className={`flex items-center gap-2 ${colors}`}>{icon}<span className="text-xs uppercase tracking-wide font-medium">{label}</span></div>
      <div className="text-3xl font-bold mt-2">{value}</div>
    </div>
  );
}
