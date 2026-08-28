-- Add columns for waitResponse node functionality
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS waiting_response BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS waiting_response_timeout TIMESTAMP WITH TIME ZONE;

-- Create index for efficient timeout queries
CREATE INDEX IF NOT EXISTS idx_contacts_waiting_response_timeout 
ON public.contacts (waiting_response_timeout) 
WHERE waiting_response = true;