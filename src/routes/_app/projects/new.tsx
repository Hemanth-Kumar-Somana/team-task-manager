import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity";

export const Route = createFileRoute("/_app/projects/new")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle();
    if (data?.role !== "team_lead") throw redirect({ to: "/projects" });
  },
  component: NewProject,
});

function NewProject() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required");
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("projects").insert({ name, description, created_by: user!.id }).select().single();
    if (error) { toast.error(error.message); setBusy(false); return; }
    await logActivity({ project_id: data.id, action: "Created project", details: name });
    toast.success("Project created");
    router.navigate({ to: "/projects/$id", params: { id: data.id } });
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-4">New Project</h1>
      <form onSubmit={submit} className="bg-card border rounded-lg p-5 space-y-4">
        <div>
          <label className="text-sm font-medium">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 bg-background" />
        </div>
        <div>
          <label className="text-sm font-medium">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="mt-1 w-full border rounded px-3 py-2 bg-background" />
        </div>
        <button disabled={busy} className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium disabled:opacity-50">{busy ? "Creating..." : "Create"}</button>
      </form>
    </div>
  );
}
