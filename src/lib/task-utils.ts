export const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  pending_review: "Pending Review",
  verified_completed: "Verified Completed",
  needs_rework: "Needs Rework",
};

export const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-info/15 text-info",
  pending_review: "bg-warning/20 text-warning",
  verified_completed: "bg-success/15 text-success",
  needs_rework: "bg-destructive/15 text-destructive",
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/15 text-info",
  high: "bg-destructive/15 text-destructive",
};

export function isOverdue(due_date: string | null, status: string) {
  if (!due_date) return false;
  if (status === "verified_completed") return false;
  return new Date(due_date) < new Date(new Date().toDateString());
}
