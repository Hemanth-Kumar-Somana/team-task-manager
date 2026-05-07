import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { CheckCircle2, ListChecks, Users, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle();
      throw redirect({ to: data?.role === "team_lead" ? "/admin" : "/member" });
    }
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="font-bold text-primary flex items-center gap-2"><ListChecks className="size-5" /> TaskFlow</div>
          <div className="flex gap-2 text-sm">
            <Link to="/login" className="px-3 py-1.5 rounded hover:bg-accent">Login</Link>
            <Link to="/signup" className="px-3 py-1.5 rounded bg-primary text-primary-foreground">Sign up</Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-bold tracking-tight">Team Task Manager</h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Plan projects, assign tasks, review submissions, and keep your team aligned — all in one place.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/signup" className="px-5 py-2.5 rounded bg-primary text-primary-foreground font-medium">Get started</Link>
          <Link to="/login" className="px-5 py-2.5 rounded border border-border">I have an account</Link>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mt-16 text-left">
          {[
            { icon: <ListChecks className="size-5 text-primary" />, t: "Task Reviews", d: "Approve or request rework with comments." },
            { icon: <Users className="size-5 text-primary" />, t: "Team Roles", d: "Team leads and members with the right access." },
            { icon: <BarChart3 className="size-5 text-primary" />, t: "Reports", d: "See progress, overdue tasks, and performance." },
          ].map((f) => (
            <div key={f.t} className="border rounded-lg p-5 bg-card">
              <div className="flex items-center gap-2 font-semibold">{f.icon}{f.t}</div>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-success" />Free demo accounts available on the login page.
        </div>
      </main>
    </div>
  );
}
