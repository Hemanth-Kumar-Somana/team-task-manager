import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<"team_lead" | "member">("member");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) return toast.error("All fields are required");
    if (password.length < 6) return toast.error("Password must be 6+ chars");
    if (password !== confirm) return toast.error("Passwords don't match");
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, role }, emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) { toast.error(error.message); setBusy(false); return; }
    toast.success("Account created!");
    router.navigate({ to: role === "team_lead" ? "/admin" : "/member" });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="text-sm text-muted-foreground">← Back</Link>
        <div className="bg-card border rounded-lg p-6 mt-3 shadow-sm">
          <h1 className="text-2xl font-bold">Create account</h1>
          <form onSubmit={submit} className="space-y-3 mt-5">
            <Field label="Full name"><input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 bg-background" /></Field>
            <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 bg-background" /></Field>
            <Field label="Password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 bg-background" /></Field>
            <Field label="Confirm password"><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 bg-background" /></Field>
            <div>
              <label className="text-sm font-medium">Role</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(["member", "team_lead"] as const).map((r) => (
                  <button type="button" key={r} onClick={() => setRole(r)} className={`border rounded px-3 py-2 text-sm ${role === r ? "border-primary bg-accent font-semibold" : ""}`}>
                    {r === "team_lead" ? "Team Lead" : "Team Member"}
                  </button>
                ))}
              </div>
            </div>
            <button disabled={busy} className="w-full bg-primary text-primary-foreground rounded py-2 font-medium disabled:opacity-50">{busy ? "Creating..." : "Sign up"}</button>
          </form>
          <p className="text-sm mt-4 text-center text-muted-foreground">
            Have an account? <Link to="/login" className="text-primary font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-sm font-medium">{label}</label>{children}</div>;
}
