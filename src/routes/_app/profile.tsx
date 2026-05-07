import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({ component: Profile });

function Profile() {
  const { user, role } = useAuth();
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setFullName(data?.full_name ?? ""));
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user!.id);
    if (error) toast.error(error.message); else toast.success("Profile updated");
    setBusy(false);
  };

  return (
    <div className="max-w-md space-y-5">
      <h1 className="text-2xl font-bold">My Profile</h1>
      <form onSubmit={save} className="bg-card border rounded-lg p-5 space-y-3">
        <div>
          <label className="text-sm font-medium">Email</label>
          <input value={user?.email ?? ""} disabled className="mt-1 w-full border rounded px-3 py-2 bg-muted text-muted-foreground" />
        </div>
        <div>
          <label className="text-sm font-medium">Role</label>
          <input value={role === "team_lead" ? "Team Lead" : "Member"} disabled className="mt-1 w-full border rounded px-3 py-2 bg-muted text-muted-foreground" />
        </div>
        <div>
          <label className="text-sm font-medium">Full name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 bg-background" />
        </div>
        <button disabled={busy} className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium disabled:opacity-50">{busy ? "Saving..." : "Save"}</button>
      </form>
    </div>
  );
}
