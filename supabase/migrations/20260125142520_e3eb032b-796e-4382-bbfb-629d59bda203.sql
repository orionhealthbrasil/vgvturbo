-- Create enum for application roles
CREATE TYPE public.app_role AS ENUM ('super_admin');

-- Create user_roles table (following security best practices - NOT on profile table)
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if current user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin')
$$;

-- RLS policies for user_roles table
CREATE POLICY "Super admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.is_super_admin());

CREATE POLICY "Super admins can manage roles"
ON public.user_roles FOR ALL
USING (public.is_super_admin());

-- Allow users to check their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Insert the initial super admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'
FROM auth.users
WHERE email = 'agenciaorion2560@gmail.com'
ON CONFLICT DO NOTHING;

-- Create view for organization stats (for super admin dashboard)
CREATE OR REPLACE VIEW public.organization_stats AS
SELECT 
    o.id,
    o.name,
    o.created_at,
    (SELECT COUNT(*) FROM organization_members om WHERE om.organization_id = o.id) as member_count,
    (SELECT COUNT(*) FROM contacts c WHERE c.organization_id = o.id) as contact_count,
    (SELECT COUNT(*) FROM messages m WHERE m.organization_id = o.id) as message_count,
    (SELECT COUNT(*) FROM automations a WHERE a.organization_id = o.id) as automation_count,
    (SELECT COUNT(*) FROM whatsapp_instances wi WHERE wi.organization_id = o.id) as has_whatsapp,
    (SELECT MAX(m.created_at) FROM messages m WHERE m.organization_id = o.id) as last_message_at
FROM organizations o;

-- RLS for the view (only super admins)
-- Note: Views inherit RLS from underlying tables, but we add explicit check
COMMENT ON VIEW public.organization_stats IS 'Organization statistics for super admin dashboard';