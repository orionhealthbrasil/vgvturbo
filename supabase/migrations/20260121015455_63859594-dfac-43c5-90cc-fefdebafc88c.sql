-- 1. Create organization role enum
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member');

-- 2. Create organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Create organization_members table
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role org_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- 4. Add organization_id to salespeople (nullable for existing data)
ALTER TABLE public.salespeople 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 5. Add organization_id to reviews (nullable for existing data)
ALTER TABLE public.reviews 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 6. Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- 7. Security definer function to check organization membership
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id 
  FROM public.organization_members 
  WHERE user_id = _user_id 
  LIMIT 1
$$;

-- 8. Function to check if user belongs to organization
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;

-- 9. RLS policies for organizations
CREATE POLICY "Users can view their organizations"
ON public.organizations FOR SELECT
USING (public.user_belongs_to_org(auth.uid(), id));

CREATE POLICY "Owners can update their organization"
ON public.organizations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE user_id = auth.uid() 
    AND organization_id = id 
    AND role = 'owner'
  )
);

-- 10. RLS policies for organization_members
CREATE POLICY "Users can view members of their organization"
ON public.organization_members FOR SELECT
USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Owners and admins can manage members"
ON public.organization_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE user_id = auth.uid() 
    AND organization_id = organization_id 
    AND role IN ('owner', 'admin')
  )
);

-- 11. Drop old RLS policies on salespeople
DROP POLICY IF EXISTS "Authenticated users can view salespeople" ON public.salespeople;
DROP POLICY IF EXISTS "Authenticated users can create salespeople" ON public.salespeople;
DROP POLICY IF EXISTS "Authenticated users can update salespeople" ON public.salespeople;
DROP POLICY IF EXISTS "Authenticated users can delete salespeople" ON public.salespeople;

-- 12. New RLS policies for salespeople (organization-based)
CREATE POLICY "Users can view salespeople in their organization"
ON public.salespeople FOR SELECT
USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can create salespeople in their organization"
ON public.salespeople FOR INSERT
WITH CHECK (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can update salespeople in their organization"
ON public.salespeople FOR UPDATE
USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can delete salespeople in their organization"
ON public.salespeople FOR DELETE
USING (public.user_belongs_to_org(auth.uid(), organization_id));

-- 13. Drop old RLS policies on reviews
DROP POLICY IF EXISTS "Authenticated users can view reviews" ON public.reviews;
DROP POLICY IF EXISTS "Authenticated users can create reviews" ON public.reviews;

-- 14. New RLS policies for reviews (organization-based)
CREATE POLICY "Users can view reviews in their organization"
ON public.reviews FOR SELECT
USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can create reviews in their organization"
ON public.reviews FOR INSERT
WITH CHECK (public.user_belongs_to_org(auth.uid(), organization_id));

-- 15. Triggers for updated_at
CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();