import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { FolderKanban, ListChecks, Clock, CheckCircle2, AlertTriangle, RefreshCw, Users, Plus, Eye } from "lucide-react";
import { isOverdue } from "@/lib/task-utils";

export const Route = createFileRoute("/_app/admin")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle();
    if (data?.role !== "team_lead") throw redirect({ to: "/member" });
  },
  component: AdminDashboard,
});

function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ projects: 0, tasks: 0, pending: 0, verified: 0, rework: 0, overdue: 0, members: 0 });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [pj, tk, mb, act] = await Promise.all([
        supabase.from("projects").select("id", { count: "exact" }),
        supabase.from("tasks").select("id,status,due_date"),
        supabase.from("user_roles").select("user_id", { count: "exact" }).eq("role", "member"),
        supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(8),
      ]);
      const tasks = tk.data ?? [];
      setStats({
        projects: pj.count ?? 0,
        tasks: tasks.length,
        pending: tasks.filter(t => t.status === "pending_review").length,
        verified: tasks.filter(t => t.status === "verified_completed").length,
        rework: tasks.filter(t => t.status === "needs_rework").length,
        overdue: tasks.filter(t => isOverdue(t.due_date, t.status)).length,
        members: mb.count ?? 0,
      });
      setRecent(act.data ?? []);
    };
    load();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview of your team's work.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<FolderKanban />} label="Projects" value={stats.projects} />
        <Stat icon={<ListChecks />} label="Tasks" value={stats.tasks} />
        <Stat icon={<Clock />} label="Pending Review" value={stats.pending} tone="warning" />
        <Stat icon={<CheckCircle2 />} label="Verified" value={stats.verified} tone="success" />
        <Stat icon={<RefreshCw />} label="Needs Rework" value={stats.rework} tone="destructive" />
        <Stat icon={<AlertTriangle />} label="Overdue" value={stats.overdue} tone="destructive" />
        <Stat icon={<Users />} label="Active Members" value={stats.members} />
      </div>

      <div className="bg-card border rounded-lg p-5">
        <h2 className="font-semibold mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          <QA to="/projects/new" icon={<Plus className="size-4" />}>Create Project</QA>
          <QA to="/tasks/new" icon={<Plus className="size-4" />}>Create Task</QA>
          <QA to="/members" icon={<Users className="size-4" />}>Add Member</QA>
          <QA to="/tasks?filter=pending_review" icon={<Eye className="size-4" />}>Review Tasks</QA>
          <QA to="/reports" icon={<ListChecks className="size-4" />}>Generate Report</QA>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-5">
        <h2 className="font-semibold mb-3">Recent Activity</h2>
        {recent.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : (
          <ul className="space-y-2">
            {recent.map((a) => (
              <li key={a.id} className="text-sm border-l-2 border-primary/40 pl-3">
                <div className="font-medium">{a.action}</div>
                {a.details && <div className="text-muted-foreground">{a.details}</div>}
                <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: "warning" | "success" | "destructive" }) {
  const colors = tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <div className="bg-card border rounded-lg p-4">
      <div className={`flex items-center gap-2 ${colors}`}>{icon}<span className="text-xs uppercase tracking-wide font-medium">{label}</span></div>
      <div className="text-3xl font-bold mt-2">{value}</div>
    </div>
  );
}

function QA({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <Link to={to} className="inline-flex items-center gap-1.5 px-3 py-2 rounded border hover:bg-accent text-sm font-medium">{icon}{children}</Link>;
}
