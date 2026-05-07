import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, isOverdue } from "@/lib/task-utils";
import { toast } from "sonner";
import { logActivity, notify } from "@/lib/activity";
import { Trash2, Send, CheckCircle2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_app/tasks/$id")({ component: TaskDetail });

function TaskDetail() {
  const { id } = Route.useParams();
  const { user, role } = useAuth();
  const router = useRouter();
  const [task, setTask] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [reviewText, setReviewText] = useState("");

  const load = async () => {
    const [t, c] = await Promise.all([
      supabase.from("tasks").select("*, projects(name), profiles:assigned_to(full_name)").eq("id", id).maybeSingle(),
      supabase.from("task_comments").select("*, profiles:user_id(full_name)").eq("task_id", id).order("created_at", { ascending: true }),
    ]);
    setTask(t.data);
    setComments(c.data ?? []);
  };
  useEffect(() => { load(); }, [id]);

  if (!task) return <div className="text-muted-foreground">Loading…</div>;

  const isAssignee = task.assigned_to === user?.id;
  const isLead = role === "team_lead";

  const setStatus = async (status: any, action: string) => {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    await logActivity({ project_id: task.project_id, task_id: id, action, details: task.title });
    toast.success(action);
    load();
  };

  const addComment = async (commentText: string, type = "comment") => {
    if (!commentText.trim()) return;
    const { error } = await supabase.from("task_comments").insert({ task_id: id, user_id: user!.id, comment: commentText, comment_type: type });
    if (error) return toast.error(error.message);
    setText(""); setReviewText("");
    await logActivity({ project_id: task.project_id, task_id: id, action: type === "comment" ? "Added comment" : `Posted ${type}`, details: commentText.slice(0, 80) });
    load();
  };

  const submitForReview = async () => {
    await setStatus("pending_review", "Submitted for review");
    if (task.created_by !== user!.id) await notify(task.created_by, "Task ready for review", task.title, `/tasks/${id}`);
  };

  const approve = async () => {
    await addComment(reviewText || "Task approved.", "approval");
    await setStatus("verified_completed", "Approved task");
    if (task.assigned_to) await notify(task.assigned_to, "Task approved", task.title, `/tasks/${id}`);
  };

  const requestRework = async () => {
    if (!reviewText.trim()) return toast.error("Add a comment explaining the rework");
    await addComment(reviewText, "rework");
    await setStatus("needs_rework", "Requested rework");
    if (task.assigned_to) await notify(task.assigned_to, "Rework requested", reviewText.slice(0, 80), `/tasks/${id}`);
  };

  const startProgress = () => setStatus("in_progress", "Started task");

  const remove = async () => {
    if (!confirm("Delete task?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    router.navigate({ to: "/tasks" });
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <Link to="/tasks" className="text-sm text-muted-foreground">← Tasks</Link>
        <div className="flex items-start justify-between gap-3 flex-wrap mt-1">
          <div>
            <h1 className="text-2xl font-bold">{task.title}</h1>
            <div className="text-sm text-muted-foreground mt-1">
              <Link to="/projects/$id" params={{ id: task.project_id }} className="hover:underline">{task.projects?.name}</Link>
              {" • "}Assigned to {task.profiles?.full_name ?? "—"}
            </div>
          </div>
          {isLead && (
            <button onClick={remove} className="text-sm text-destructive inline-flex items-center gap-1"><Trash2 className="size-4" />Delete</button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border rounded-lg p-5">
            <h2 className="font-semibold mb-2">Description</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description || "No description provided."}</p>
          </div>

          <div className="bg-card border rounded-lg p-5">
            <h2 className="font-semibold mb-3">Activity & Comments</h2>
            {comments.length === 0 && <p className="text-sm text-muted-foreground mb-3">No comments yet.</p>}
            <ul className="space-y-3 mb-4">
              {comments.map((c) => (
                <li key={c.id} className={`border-l-2 pl-3 ${c.comment_type === "approval" ? "border-success" : c.comment_type === "rework" ? "border-destructive" : "border-primary/40"}`}>
                  <div className="text-sm"><span className="font-medium">{c.profiles?.full_name ?? "User"}</span>{c.comment_type !== "comment" && <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground">[{c.comment_type}]</span>}</div>
                  <div className="text-sm whitespace-pre-wrap">{c.comment}</div>
                  <div className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</div>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment..." className="flex-1 border rounded px-3 py-2 bg-background text-sm" />
              <button onClick={() => addComment(text)} className="bg-primary text-primary-foreground px-3 rounded text-sm">Post</button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-card border rounded-lg p-5 space-y-3 text-sm">
            <Row label="Status"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[task.status]}`}>{STATUS_LABELS[task.status]}</span></Row>
            <Row label="Priority"><span className={`text-xs px-2 py-0.5 rounded ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span></Row>
            <Row label="Due date">
              <span className={isOverdue(task.due_date, task.status) ? "text-destructive font-medium" : ""}>
                {task.due_date ? new Date(task.due_date).toLocaleDateString() : "—"}
                {isOverdue(task.due_date, task.status) && " (Overdue)"}
              </span>
            </Row>
          </div>

          {isAssignee && task.status !== "verified_completed" && (
            <div className="bg-card border rounded-lg p-5 space-y-2">
              <h3 className="font-semibold text-sm">Member actions</h3>
              {task.status === "not_started" && <button onClick={startProgress} className="w-full border rounded py-2 text-sm hover:bg-accent">Start working</button>}
              {(task.status === "in_progress" || task.status === "needs_rework") && (
                <button onClick={submitForReview} className="w-full bg-primary text-primary-foreground rounded py-2 text-sm inline-flex justify-center items-center gap-1.5"><Send className="size-4" />Submit for review</button>
              )}
            </div>
          )}

          {isLead && task.status === "pending_review" && (
            <div className="bg-card border rounded-lg p-5 space-y-2">
              <h3 className="font-semibold text-sm">Review</h3>
              <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} rows={3} placeholder="Feedback..." className="w-full border rounded px-3 py-2 bg-background text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={approve} className="bg-success/15 text-success rounded py-2 text-sm inline-flex justify-center items-center gap-1.5"><CheckCircle2 className="size-4" />Approve</button>
                <button onClick={requestRework} className="bg-destructive/15 text-destructive rounded py-2 text-sm inline-flex justify-center items-center gap-1.5"><RefreshCw className="size-4" />Rework</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span>{children}</div>;
}
