-- Create broadcast campaigns table
CREATE TABLE public.broadcast_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  message_content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT, -- 'image' or null
  
  -- Safety settings
  min_interval_seconds INTEGER NOT NULL DEFAULT 300, -- 5 minutes
  max_interval_seconds INTEGER NOT NULL DEFAULT 900, -- 15 minutes
  batch_size INTEGER NOT NULL DEFAULT 20,
  batch_pause_min_seconds INTEGER NOT NULL DEFAULT 300, -- 5 min pause
  batch_pause_max_seconds INTEGER NOT NULL DEFAULT 600, -- 10 min pause
  messages_per_hour_limit INTEGER NOT NULL DEFAULT 30,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'draft', -- draft, scheduled, running, paused, completed, cancelled
  total_contacts INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  current_batch INTEGER NOT NULL DEFAULT 0,
  
  -- Timing
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  next_send_at TIMESTAMP WITH TIME ZONE,
  paused_until TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create broadcast recipients table
CREATE TABLE public.broadcast_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.broadcast_campaigns(id) ON DELETE CASCADE,
  contact_id UUID, -- null if imported from CSV
  phone TEXT NOT NULL,
  name TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed, skipped
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  message_id UUID, -- reference to messages table if sent
  
  -- Position in queue
  position INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_recipients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for broadcast_campaigns (only owners can manage)
CREATE POLICY "Owners can view broadcast campaigns"
  ON public.broadcast_campaigns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = broadcast_campaigns.organization_id
        AND om.role = 'owner'
    )
  );

CREATE POLICY "Owners can create broadcast campaigns"
  ON public.broadcast_campaigns FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = broadcast_campaigns.organization_id
        AND om.role = 'owner'
    )
  );

CREATE POLICY "Owners can update broadcast campaigns"
  ON public.broadcast_campaigns FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = broadcast_campaigns.organization_id
        AND om.role = 'owner'
    )
  );

CREATE POLICY "Owners can delete broadcast campaigns"
  ON public.broadcast_campaigns FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = broadcast_campaigns.organization_id
        AND om.role = 'owner'
    )
  );

-- RLS Policies for broadcast_recipients
CREATE POLICY "Owners can view broadcast recipients"
  ON public.broadcast_recipients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM broadcast_campaigns bc
      JOIN organization_members om ON om.organization_id = bc.organization_id
      WHERE bc.id = broadcast_recipients.campaign_id
        AND om.user_id = auth.uid()
        AND om.role = 'owner'
    )
  );

CREATE POLICY "Owners can create broadcast recipients"
  ON public.broadcast_recipients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM broadcast_campaigns bc
      JOIN organization_members om ON om.organization_id = bc.organization_id
      WHERE bc.id = broadcast_recipients.campaign_id
        AND om.user_id = auth.uid()
        AND om.role = 'owner'
    )
  );

CREATE POLICY "Owners can update broadcast recipients"
  ON public.broadcast_recipients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM broadcast_campaigns bc
      JOIN organization_members om ON om.organization_id = bc.organization_id
      WHERE bc.id = broadcast_recipients.campaign_id
        AND om.user_id = auth.uid()
        AND om.role = 'owner'
    )
  );

CREATE POLICY "Owners can delete broadcast recipients"
  ON public.broadcast_recipients FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM broadcast_campaigns bc
      JOIN organization_members om ON om.organization_id = bc.organization_id
      WHERE bc.id = broadcast_recipients.campaign_id
        AND om.user_id = auth.uid()
        AND om.role = 'owner'
    )
  );

-- Create indexes for performance
CREATE INDEX idx_broadcast_campaigns_org ON public.broadcast_campaigns(organization_id);
CREATE INDEX idx_broadcast_campaigns_status ON public.broadcast_campaigns(status);
CREATE INDEX idx_broadcast_recipients_campaign ON public.broadcast_recipients(campaign_id);
CREATE INDEX idx_broadcast_recipients_status ON public.broadcast_recipients(status);
CREATE INDEX idx_broadcast_recipients_position ON public.broadcast_recipients(campaign_id, position);

-- Trigger for updated_at
CREATE TRIGGER update_broadcast_campaigns_updated_at
  BEFORE UPDATE ON public.broadcast_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();