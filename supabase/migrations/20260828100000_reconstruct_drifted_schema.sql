-- Reconstructs tables/columns that existed in the source (audizap/OrionChat) live
-- database but were never captured in any tracked migration there (pure schema
-- drift). Reverse-engineered via read-only introspection of the source project.

-- Enum used by sla_response_events
DO $$ BEGIN
  CREATE TYPE public.sla_event_ended_by AS ENUM ('human', 'automation', 'ai_agent', 'conversation_closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Gestão (Projects/Tasks) module ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  description text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view projects" ON public.projects;
CREATE POLICY "Members can view projects" ON public.projects FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Members can create projects" ON public.projects;
CREATE POLICY "Members can create projects" ON public.projects FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id) AND created_by = auth.uid());
DROP POLICY IF EXISTS "Members can update projects" ON public.projects;
CREATE POLICY "Members can update projects" ON public.projects FOR UPDATE USING (user_belongs_to_org(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Owners and admins can delete projects" ON public.projects;
CREATE POLICY "Owners and admins can delete projects" ON public.projects FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.organization_members om WHERE om.user_id = auth.uid() AND om.organization_id = projects.organization_id AND om.role = ANY (ARRAY['owner'::org_role, 'admin'::org_role]))
);

CREATE TABLE IF NOT EXISTS public.project_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  icon text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);
ALTER TABLE public.project_areas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view project areas" ON public.project_areas;
CREATE POLICY "Members can view project areas" ON public.project_areas FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Members can manage project areas" ON public.project_areas;
CREATE POLICY "Members can manage project areas" ON public.project_areas FOR ALL USING (user_belongs_to_org(auth.uid(), organization_id)) WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  area_id uuid REFERENCES public.project_areas(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'medium',
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view tasks" ON public.tasks;
CREATE POLICY "Members can view tasks" ON public.tasks FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Members can create tasks" ON public.tasks;
CREATE POLICY "Members can create tasks" ON public.tasks FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id) AND created_by = auth.uid());
DROP POLICY IF EXISTS "Members can update tasks" ON public.tasks;
CREATE POLICY "Members can update tasks" ON public.tasks FOR UPDATE USING (user_belongs_to_org(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Members can delete tasks" ON public.tasks;
CREATE POLICY "Members can delete tasks" ON public.tasks FOR DELETE USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE TABLE IF NOT EXISTS public.task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view task assignees" ON public.task_assignees;
CREATE POLICY "Members can view task assignees" ON public.task_assignees FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_assignees.task_id AND user_belongs_to_org(auth.uid(), t.organization_id))
);
DROP POLICY IF EXISTS "Members can manage task assignees" ON public.task_assignees;
CREATE POLICY "Members can manage task assignees" ON public.task_assignees FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_assignees.task_id AND user_belongs_to_org(auth.uid(), t.organization_id))
);
DROP POLICY IF EXISTS "Members can delete task assignees" ON public.task_assignees;
CREATE POLICY "Members can delete task assignees" ON public.task_assignees FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_assignees.task_id AND user_belongs_to_org(auth.uid(), t.organization_id))
);

CREATE TABLE IF NOT EXISTS public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view attachments" ON public.task_attachments;
CREATE POLICY "Members can view attachments" ON public.task_attachments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_attachments.task_id AND user_belongs_to_org(auth.uid(), t.organization_id))
);
DROP POLICY IF EXISTS "Members can upload attachments" ON public.task_attachments;
CREATE POLICY "Members can upload attachments" ON public.task_attachments FOR INSERT WITH CHECK (
  uploaded_by = auth.uid() AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_attachments.task_id AND user_belongs_to_org(auth.uid(), t.organization_id))
);
DROP POLICY IF EXISTS "Uploader can delete attachments" ON public.task_attachments;
CREATE POLICY "Uploader can delete attachments" ON public.task_attachments FOR DELETE USING (uploaded_by = auth.uid());

CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  mentioned_user_ids uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view comments" ON public.task_comments;
CREATE POLICY "Members can view comments" ON public.task_comments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_comments.task_id AND user_belongs_to_org(auth.uid(), t.organization_id))
);
DROP POLICY IF EXISTS "Members can create comments" ON public.task_comments;
CREATE POLICY "Members can create comments" ON public.task_comments FOR INSERT WITH CHECK (
  user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_comments.task_id AND user_belongs_to_org(auth.uid(), t.organization_id))
);
DROP POLICY IF EXISTS "Authors can update their comments" ON public.task_comments;
CREATE POLICY "Authors can update their comments" ON public.task_comments FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Authors can delete their comments" ON public.task_comments;
CREATE POLICY "Authors can delete their comments" ON public.task_comments FOR DELETE USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.task_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.task_subtasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view subtasks" ON public.task_subtasks;
CREATE POLICY "Members can view subtasks" ON public.task_subtasks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_subtasks.task_id AND user_belongs_to_org(auth.uid(), t.organization_id))
);
DROP POLICY IF EXISTS "Members can manage subtasks" ON public.task_subtasks;
CREATE POLICY "Members can manage subtasks" ON public.task_subtasks FOR ALL USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_subtasks.task_id AND user_belongs_to_org(auth.uid(), t.organization_id))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_subtasks.task_id AND user_belongs_to_org(auth.uid(), t.organization_id))
);

-- ── Lead capture forms ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lead_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  description text,
  logo_url text,
  primary_color text NOT NULL DEFAULT '#6366f1',
  thank_you_message text NOT NULL DEFAULT 'Recebemos seu contato! Em breve retornaremos.',
  redirect_url text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_tags text[] NOT NULL DEFAULT '{}'::text[],
  pipeline_id uuid REFERENCES public.kanban_pipelines(id) ON DELETE SET NULL,
  kanban_column_id uuid REFERENCES public.kanban_columns(id) ON DELETE SET NULL,
  funnel_stage text,
  assignment_strategy text NOT NULL DEFAULT 'none',
  assigned_to uuid,
  is_active boolean NOT NULL DEFAULT true,
  submission_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
ALTER TABLE public.lead_forms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members view forms" ON public.lead_forms;
CREATE POLICY "Members view forms" ON public.lead_forms FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Owners/admins manage forms" ON public.lead_forms;
CREATE POLICY "Owners/admins manage forms" ON public.lead_forms FOR ALL USING (
  EXISTS (SELECT 1 FROM public.organization_members om WHERE om.user_id = auth.uid() AND om.organization_id = lead_forms.organization_id AND om.role = ANY (ARRAY['owner'::org_role, 'admin'::org_role]))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.organization_members om WHERE om.user_id = auth.uid() AND om.organization_id = lead_forms.organization_id AND om.role = ANY (ARRAY['owner'::org_role, 'admin'::org_role]))
);

CREATE TABLE IF NOT EXISTS public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.lead_forms(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  status text NOT NULL DEFAULT 'received',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members view submissions" ON public.form_submissions;
CREATE POLICY "Members view submissions" ON public.form_submissions FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));

-- ── SLA response analytics ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sla_response_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  assigned_to uuid,
  agent_name text,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL DEFAULT now(),
  duration_minutes integer NOT NULL DEFAULT 0,
  wall_duration_minutes integer NOT NULL DEFAULT 0,
  ended_by public.sla_event_ended_by NOT NULL,
  breached_sla boolean NOT NULL DEFAULT false,
  threshold_at_event integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sla_response_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members view sla events" ON public.sla_response_events;
CREATE POLICY "Members view sla events" ON public.sla_response_events FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Service role insert sla events" ON public.sla_response_events;
CREATE POLICY "Service role insert sla events" ON public.sla_response_events FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

-- ── Missing columns on existing tables ───────────────────────────────────────

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_phone text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_name text;

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS sla_alert_whatsapp_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS listing_type text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS neighborhood text;

ALTER TABLE public.broadcast_campaigns ADD COLUMN IF NOT EXISTS automation_id uuid;

ALTER TABLE public.funnel_stage_transitions ADD COLUMN IF NOT EXISTS label text;
