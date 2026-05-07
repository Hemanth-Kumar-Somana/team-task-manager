import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity, notify } from "@/lib/activity";

export const Route = createFileRoute("/_app/tasks/new")({
  validateSearch: (s: Record<string, unknown>) => ({ project: (s.project as string) || "" }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle();
    if (data?.role !== "team_lead") throw redirect({ to: "/tasks" });
  },
  component: NewTask,
});

function NewTask() {
  const router = useRouter();
  const search = Route.useSearch();
  const [projects, setProjects] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: "", description: "", project_id: search.project, assigned_to: "", priority: "medium", due_date: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("projects").select("id,name").then(({ data }) => {
      setProjects(data ?? []);
      if (!form.project_id && data?.[0]) setForm(f => ({ ...f, project_id: data[0].id }));
    });
    supabase.from("profiles").select("id,full_name,email").then(({ data }) => setMembers(data ?? []));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.project_id) return toast.error("Title and project are required");
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = { ...form, created_by: user!.id };
    if (!payload.assigned_to) payload.assigned_to = null;
    if (!payload.due_date) payload.due_date = null;
    const { data, error } = await supabase.from("tasks").insert(payload).select().single();
    if (error) { toast.error(error.message); setBusy(false); return; }
    await logActivity({ project_id: form.project_id, task_id: data.id, action: "Created task", details: form.title });
    if (form.assigned_to) await notify(form.assigned_to, "New task assigned", form.title, `/tasks/${data.id}`);
    toast.success("Task created");
    router.navigate({ to: "/tasks/$id", params: { id: data.id } });
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-4">New Task</h1>
      <form onSubmit={submit} className="bg-card border rounded-lg p-5 space-y-4">
        <Field label="Title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full border rounded px-3 py-2 bg-background" /></Field>
        <Field label="Description"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="mt-1 w-full border rounded px-3 py-2 bg-background" /></Field>
        <Field label="Project">
          <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} className="mt-1 w-full border rounded px-3 py-2 bg-background">
            <option value="">Select project...</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Assignee">
          <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} className="mt-1 w-full border rounded px-3 py-2 bg-background">
            <option value="">Unassigned</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="mt-1 w-full border rounded px-3 py-2 bg-background">
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </Field>
          <Field label="Due date">
            <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="mt-1 w-full border rounded px-3 py-2 bg-background" />
          </Field>
        </div>
        <button disabled={busy} className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium disabled:opacity-50">{busy ? "Creating..." : "Create task"}</button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-sm font-medium">{label}</label>{children}</div>;
}
