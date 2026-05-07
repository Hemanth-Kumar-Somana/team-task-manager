import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_app/members")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle();
    if (data?.role !== "team_lead") throw redirect({ to: "/member" });
  },
  component: Members,
});

function Members() {
  const [members, setMembers] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, any>>({});

  useEffect(() => {
    const load = async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role, profiles:user_id(full_name, email)");
      setMembers(roles ?? []);
      const { data: tasks } = await supabase.from("tasks").select("assigned_to, status");
      const map: Record<string, any> = {};
      (tasks ?? []).forEach((t: any) => {
        if (!t.assigned_to) return;
        map[t.assigned_to] = map[t.assigned_to] || { total: 0, done: 0, pending: 0 };
        map[t.assigned_to].total++;
        if (t.status === "verified_completed") map[t.assigned_to].done++;
        if (t.status === "pending_review") map[t.assigned_to].pending++;
      });
      setStats(map);
    };
    load();
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2"><Users className="size-6" /><h1 className="text-2xl font-bold">Team Members</h1></div>
      <div className="bg-card border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr><th className="p-3">Name</th><th>Email</th><th>Role</th><th>Tasks</th><th>Completed</th><th>Pending Review</th></tr></thead>
          <tbody>
            {members.map((m: any) => {
              const s = stats[m.user_id] || { total: 0, done: 0, pending: 0 };
              return (
                <tr key={`${m.user_id}-${m.role}`} className="border-t">
                  <td className="p-3 font-medium">{m.profiles?.full_name || "—"}</td>
                  <td>{m.profiles?.email}</td>
                  <td><span className="text-xs px-2 py-0.5 rounded bg-accent">{m.role === "team_lead" ? "Team Lead" : "Member"}</span></td>
                  <td>{s.total}</td>
                  <td className="text-success">{s.done}</td>
                  <td className="text-warning">{s.pending}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
