-- Add sla_enabled column to organizations table
ALTER TABLE public.organizations 
ADD COLUMN sla_enabled boolean NOT NULL DEFAULT false;