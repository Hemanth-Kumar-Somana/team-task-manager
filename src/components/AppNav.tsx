import { Link, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Bell, LogOut, LayoutDashboard, FolderKanban, ListChecks, Users, BarChart3, User as UserIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function AppNav() {
  const { user, role, signOut } = useAuth();
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { count } = await supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false);
      setUnread(count ?? 0);
    };
    load();
    const ch = supabase.channel("notif-nav").on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    router.navigate({ to: "/login" });
  };

  const isLead = role === "team_lead";

  return (
    <header className="border-b bg-card sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-1">
        <Link to={isLead ? "/admin" : "/member"} className="font-bold text-primary mr-4 flex items-center gap-2">
          <ListChecks className="size-5" />
          <span>TaskFlow</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm flex-1 overflow-x-auto">
          <NavLink to={isLead ? "/admin" : "/member"} icon={<LayoutDashboard className="size-4" />}>Dashboard</NavLink>
          <NavLink to="/projects" icon={<FolderKanban className="size-4" />}>Projects</NavLink>
          <NavLink to="/tasks" icon={<ListChecks className="size-4" />}>Tasks</NavLink>
          {isLead && <NavLink to="/members" icon={<Users className="size-4" />}>Members</NavLink>}
          {isLead && <NavLink to="/reports" icon={<BarChart3 className="size-4" />}>Reports</NavLink>}
        </nav>
        <Link to="/notifications" className="relative p-2 rounded hover:bg-accent" aria-label="Notifications">
          <Bell className="size-5" />
          {unread > 0 && <span className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-[10px] rounded-full h-4 min-w-4 px-1 flex items-center justify-center">{unread}</span>}
        </Link>
        <Link to="/profile" className="p-2 rounded hover:bg-accent" aria-label="Profile"><UserIcon className="size-5" /></Link>
        <button onClick={handleSignOut} className="p-2 rounded hover:bg-accent" aria-label="Sign out"><LogOut className="size-5" /></button>
      </div>
    </header>
  );
}

function NavLink({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link to={to} className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-accent text-foreground/70 [&.active]:bg-accent [&.active]:text-foreground" activeProps={{ className: "active" }}>
      {icon}{children}
    </Link>
  );
}
