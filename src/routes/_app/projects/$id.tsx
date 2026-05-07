import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { STATUS_COLORS, STATUS_LABELS, isOverdue } from "@/lib/task-utils";
import { Plus, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { logActivity, notify } from "@/lib/activity";

export const Route = createFileRoute("/_app/projects/$id")({ component: ProjectDetail });

function ProjectDetail() {
  const { id } = Route.useParams();
  const { role } = useAuth();
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    const [p, t, m, am] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).maybeSingle(),
      supabase.from("tasks").select("*, profiles:assigned_to(full_name)").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("project_members").select("user_id, profiles:user_id(full_name, email)").eq("project_id", id),
      supabase.from("profiles").select("id, full_name, email"),
    ]);
    setProject(p.data);
    setTasks(t.data ?? []);
    setMembers(m.data ?? []);
    setAllMembers(am.data ?? []);
  };
  useEffect(() => { load(); }, [id]);

  if (!project) return <div className="text-muted-foreground">Loading…</div>;

  const total = tasks.length;
  const done = tasks.filter(t => t.status === "verified_completed").length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const addMember = async (uid: string) => {
    const { error } = await supabase.from("project_members").insert({ project_id: id, user_id: uid });
    if (error) return toast.error(error.message);
    await logActivity({ project_id: id, action: "Added member to project" });
    await notify(uid, "Added to project", `You were added to "${project.name}"`, `/projects/${id}`);
    toast.success("Member added");
    load();
  };

  const removeMember = async (uid: string) => {
    const { error } = await supabase.from("project_members").delete().eq("project_id", id).eq("user_id", uid);
    if (error) return toast.error(error.message);
    load();
  };

  const deleteProject = async () => {
    if (!confirm("Delete this project and all its tasks?")) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    router.navigate({ to: "/projects" });
  };

  const candidates = allMembers.filter(p => !members.find(m => m.user_id === p.id));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link to="/projects" className="text-sm text-muted-foreground">← Projects</Link>
          <h1 className="text-2xl font-bold mt-1">{project.name}</h1>
          <p className="text-muted-foreground">{project.description || "No description"}</p>
        </div>
        {role === "team_lead" && (
          <div className="flex gap-2">
            <Link to="/tasks/new" search={{ project: id } as any} className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium">
              <Plus className="size-4" />Add Task
            </Link>
            <button onClick={deleteProject} className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-destructive/30 text-destructive text-sm">
              <Trash2 className="size-4" />Delete
            </button>
          </div>
        )}
      </div>

      <div className="bg-card border rounded-lg p-4">
        <div className="flex justify-between text-sm"><span className="font-medium">Completion</span><span>{done}/{total} ({pct}%)</span></div>
        <div className="h-2 bg-muted rounded mt-2 overflow-hidden"><div className="h-full bg-success" style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border rounded-lg p-5">
          <h2 className="font-semibold mb-3">Tasks</h2>
          {tasks.length === 0 ? <p className="text-sm text-muted-foreground">No tasks yet.</p> : (
            <ul className="divide-y">
              {tasks.map((t) => (
                <li key={t.id} className="py-2 flex items-center justify-between gap-2">
                  <div>
                    <Link to="/tasks/$id" params={{ id: t.id }} className="font-medium hover:underline">{t.title}</Link>
                    <div className="text-xs text-muted-foreground">{t.profiles?.full_name ?? "Unassigned"}{t.due_date ? ` • Due ${new Date(t.due_date).toLocaleDateString()}` : ""}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[t.status]}`}>
                    {isOverdue(t.due_date, t.status) ? "Overdue" : STATUS_LABELS[t.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-card border rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Members</h2>
            {role === "team_lead" && (
              <button onClick={() => setAddOpen(o => !o)} className="text-sm inline-flex items-center gap-1 text-primary"><UserPlus className="size-4" />Add</button>
            )}
          </div>
          {addOpen && (
            <div className="mb-3 border rounded p-2 max-h-40 overflow-auto space-y-1">
              {candidates.length === 0 ? <p className="text-xs text-muted-foreground">No more users.</p> : candidates.map(c => (
                <button key={c.id} onClick={() => addMember(c.id)} className="w-full text-left text-sm hover:bg-accent rounded px-2 py-1">
                  {c.full_name || c.email}
                </button>
              ))}
            </div>
          )}
          {members.length === 0 ? <p className="text-sm text-muted-foreground">No members yet.</p> : (
            <ul className="space-y-2">
              {members.map((m: any) => (
                <li key={m.user_id} className="flex items-center justify-between text-sm">
                  <span>{m.profiles?.full_name || m.profiles?.email}</span>
                  {role === "team_lead" && <button onClick={() => removeMember(m.user_id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
