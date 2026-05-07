import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

const DEMO = [
  { label: "Team Lead 1", email: "teamlead1@test.com", password: "admin123", role: "team_lead", name: "Alex Lead" },
  { label: "Team Lead 2", email: "teamlead2@test.com", password: "admin123", role: "team_lead", name: "Jordan Lead" },
  { label: "Member 1", email: "member1@test.com", password: "member123", role: "member", name: "Sam Member" },
  { label: "Member 2", email: "member2@test.com", password: "member123", role: "member", name: "Riley Member" },
];

function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Email and password required"); return; }
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { toast.error(error.message); setBusy(false); return; }
    const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user!.id).maybeSingle();
    toast.success("Welcome back!");
    router.navigate({ to: r?.role === "team_lead" ? "/admin" : "/member" });
  };

  const autoFill = (acc: typeof DEMO[number]) => {
    setEmail(acc.email);
    setPassword(acc.password);
  };

  const seedAndLogin = async (acc: typeof DEMO[number]) => {
    setBusy(true);
    // Try sign in first
    let { error } = await supabase.auth.signInWithPassword({ email: acc.email, password: acc.password });
    if (error) {
      // create then sign in
      const { error: e2 } = await supabase.auth.signUp({
        email: acc.email,
        password: acc.password,
        options: { data: { full_name: acc.name, role: acc.role }, emailRedirectTo: `${window.location.origin}/` },
      });
      if (e2 && !e2.message.includes("registered")) { toast.error(e2.message); setBusy(false); return; }
      const r2 = await supabase.auth.signInWithPassword({ email: acc.email, password: acc.password });
      if (r2.error) { toast.error(r2.error.message); setBusy(false); return; }
    }
    const { data: u } = await supabase.auth.getUser();
    const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", u.user!.id).maybeSingle();
    toast.success(`Logged in as ${acc.label}`);
    router.navigate({ to: r?.role === "team_lead" ? "/admin" : "/member" });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="text-sm text-muted-foreground">← Back</Link>
        <div className="bg-card border rounded-lg p-6 mt-3 shadow-sm">
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome back to TaskFlow.</p>
          <form onSubmit={submit} className="space-y-3 mt-5">
            <div>
              <label className="text-sm font-medium">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 bg-background" />
            </div>
            <div>
              <label className="text-sm font-medium">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 bg-background" />
            </div>
            <button disabled={busy} className="w-full bg-primary text-primary-foreground rounded py-2 font-medium disabled:opacity-50">{busy ? "Signing in..." : "Sign in"}</button>
          </form>
          <p className="text-sm mt-4 text-center text-muted-foreground">
            No account? <Link to="/signup" className="text-primary font-medium">Sign up</Link>
          </p>

          <div className="mt-6 border-t pt-5">
            <h2 className="text-sm font-semibold">Demo accounts</h2>
            <p className="text-xs text-muted-foreground mb-3">Click "Auto Fill" or "Login" to instantly use a test account (auto-created on first use).</p>
            <div className="space-y-2">
              {DEMO.map((acc) => (
                <div key={acc.email} className="flex items-center justify-between gap-2 text-xs border rounded px-3 py-2">
                  <div>
                    <div className="font-medium">{acc.label}</div>
                    <div className="text-muted-foreground">{acc.email}</div>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => autoFill(acc)} className="px-2 py-1 rounded border hover:bg-accent">Auto Fill</button>
                    <button type="button" disabled={busy} onClick={() => seedAndLogin(acc)} className="px-2 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50">Login</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
