-- Add status and closed_at columns to contacts table
ALTER TABLE public.contacts 
ADD COLUMN status text NOT NULL DEFAULT 'open',
ADD COLUMN closed_at timestamp with time zone;

-- Add check constraint for valid status values
ALTER TABLE public.contacts
ADD CONSTRAINT contacts_status_check CHECK (status IN ('open', 'closed'));

-- Create index for faster filtering by status
CREATE INDEX idx_contacts_status ON public.contacts(status);

-- Create index for ordering closed contacts
CREATE INDEX idx_contacts_closed_at ON public.contacts(closed_at DESC NULLS LAST);