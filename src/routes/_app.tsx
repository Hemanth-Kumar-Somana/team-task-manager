import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppNav } from "@/components/AppNav";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

function AppLayout() {
  const { loading, user } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return null;
  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="max-w-7xl mx-auto px-4 py-6"><Outlet /></main>
    </div>
  );
}
