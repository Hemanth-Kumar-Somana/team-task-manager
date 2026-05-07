import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Plus, FolderKanban, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity";

export const Route = createFileRoute("/_app/projects/")({ component: Projects });

function Projects() {
  const { role } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const load = async () => {
    const { data } = await supabase.from("projects").select("*, tasks(id,status)").order("created_at", { ascending: false });
    setProjects(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete project "${name}"?`)) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logActivity({ project_id: null, action: "Deleted project", details: name });
    toast.success("Deleted");
    load();
  };

  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Projects</h1>
        {role === "team_lead" && (
          <Link to="/projects/new" className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium">
            <Plus className="size-4" />New Project
          </Link>
        )}
      </div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects..." className="w-full max-w-sm border rounded px-3 py-2 bg-background" />
      {filtered.length === 0 ? (
        <div className="bg-card border rounded-lg p-10 text-center text-muted-foreground">
          <FolderKanban className="mx-auto size-8 mb-2 opacity-50" />No projects yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => {
            const total = p.tasks?.length ?? 0;
            const done = p.tasks?.filter((t: any) => t.status === "verified_completed").length ?? 0;
            const pct = total ? Math.round((done / total) * 100) : 0;
            return (
              <div key={p.id} className="bg-card border rounded-lg p-4 hover:shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <Link to="/projects/$id" params={{ id: p.id }} className="font-semibold hover:text-primary">{p.name}</Link>
                  {role === "team_lead" && (
                    <button onClick={() => remove(p.id, p.name)} className="text-muted-foreground hover:text-destructive p-1" aria-label="Delete"><Trash2 className="size-4" /></button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2 min-h-10">{p.description || "No description"}</p>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground"><span>{done}/{total} tasks</span><span>{pct}%</span></div>
                  <div className="h-1.5 bg-muted rounded mt-1 overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
