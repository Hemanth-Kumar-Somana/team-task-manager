
-- ROLES
CREATE TYPE public.app_role AS ENUM ('team_lead', 'member');
CREATE TYPE public.task_status AS ENUM ('not_started','in_progress','pending_review','verified_completed','needs_rework');
CREATE TYPE public.task_priority AS ENUM ('low','medium','high');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email);
  -- default role from metadata, fallback to member
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'member'::app_role))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PROJECTS
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- PROJECT MEMBERS
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_project_member(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.project_members WHERE project_id=_project_id AND user_id=_user_id)
  OR EXISTS(SELECT 1 FROM public.projects WHERE id=_project_id AND created_by=_user_id);
$$;

-- TASKS
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status task_status NOT NULL DEFAULT 'not_started',
  priority task_priority NOT NULL DEFAULT 'medium',
  due_date DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- TASK COMMENTS
CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  comment_type TEXT NOT NULL DEFAULT 'comment', -- comment | review | rework | approval
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- ACTIVITY LOGS
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- profiles: anyone authenticated can read; user can update own
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid()=id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid()=id);

-- user_roles: read own + leads see all; only system inserts
CREATE POLICY "roles_select_self_or_lead" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid()=user_id OR public.has_role(auth.uid(),'team_lead'));
CREATE POLICY "roles_lead_manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'team_lead')) WITH CHECK (public.has_role(auth.uid(),'team_lead'));

-- projects: lead full; members can view projects they belong to
CREATE POLICY "projects_lead_all" ON public.projects FOR ALL TO authenticated USING (public.has_role(auth.uid(),'team_lead')) WITH CHECK (public.has_role(auth.uid(),'team_lead'));
CREATE POLICY "projects_member_select" ON public.projects FOR SELECT TO authenticated USING (public.is_project_member(id, auth.uid()));

-- project_members: leads manage; users see rows for projects they're in
CREATE POLICY "pm_lead_all" ON public.project_members FOR ALL TO authenticated USING (public.has_role(auth.uid(),'team_lead')) WITH CHECK (public.has_role(auth.uid(),'team_lead'));
CREATE POLICY "pm_member_select" ON public.project_members FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.is_project_member(project_id, auth.uid()));

-- tasks: leads full; members select tasks in their projects; members update own assigned tasks
CREATE POLICY "tasks_lead_all" ON public.tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(),'team_lead')) WITH CHECK (public.has_role(auth.uid(),'team_lead'));
CREATE POLICY "tasks_member_select" ON public.tasks FOR SELECT TO authenticated USING (public.is_project_member(project_id, auth.uid()) OR assigned_to=auth.uid());
CREATE POLICY "tasks_member_update_assigned" ON public.tasks FOR UPDATE TO authenticated USING (assigned_to=auth.uid()) WITH CHECK (assigned_to=auth.uid());

-- task_comments: insert if can see task; select if can see task
CREATE POLICY "comments_select" ON public.task_comments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id=task_id AND (public.has_role(auth.uid(),'team_lead') OR t.assigned_to=auth.uid() OR public.is_project_member(t.project_id, auth.uid())))
);
CREATE POLICY "comments_insert" ON public.task_comments FOR INSERT TO authenticated WITH CHECK (
  user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id=task_id AND (public.has_role(auth.uid(),'team_lead') OR t.assigned_to=auth.uid() OR public.is_project_member(t.project_id, auth.uid())))
);

-- activity_logs: anyone authenticated can insert their own; lead reads all; member reads their projects/tasks
CREATE POLICY "logs_insert_own" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid());
CREATE POLICY "logs_select_lead" ON public.activity_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'team_lead') OR user_id=auth.uid());

-- notifications: user sees own
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated USING (user_id=auth.uid());
CREATE POLICY "notif_insert_lead_or_self" ON public.notifications FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid() OR public.has_role(auth.uid(),'team_lead'));

-- updated_at trigger for tasks
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER tasks_touch BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
