import { supabase } from "@/integrations/supabase/client";

export async function logActivity(opts: { project_id?: string | null; task_id?: string | null; action: string; details?: string; }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("activity_logs").insert({
    user_id: user.id,
    project_id: opts.project_id ?? null,
    task_id: opts.task_id ?? null,
    action: opts.action,
    details: opts.details ?? "",
  });
}

export async function notify(user_id: string, title: string, message: string, link = "") {
  await supabase.from("notifications").insert({ user_id, title, message, link });
}
