-- Drop the incorrect foreign key constraint
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_assigned_to_fkey;

-- Re-add the foreign key referencing auth.users(id) which is the user_id we use
ALTER TABLE public.contacts 
ADD CONSTRAINT contacts_assigned_to_fkey 
FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;