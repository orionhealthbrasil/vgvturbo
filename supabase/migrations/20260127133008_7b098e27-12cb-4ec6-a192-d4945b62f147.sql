-- Create table for internal chat polls
CREATE TABLE public.internal_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.internal_conversations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_anonymous boolean NOT NULL DEFAULT false,
  is_multiple_choice boolean NOT NULL DEFAULT false,
  is_closed boolean NOT NULL DEFAULT false,
  closes_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table for poll votes
CREATE TABLE public.internal_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.internal_polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  option_index integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id, option_index)
);

-- Enable RLS
ALTER TABLE public.internal_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_poll_votes ENABLE ROW LEVEL SECURITY;

-- RLS policies for polls (only participants can view/create)
CREATE POLICY "Users can view polls in their conversations"
ON public.internal_polls FOR SELECT
USING (is_internal_conversation_participant(conversation_id));

CREATE POLICY "Users can create polls in their conversations"
ON public.internal_polls FOR INSERT
WITH CHECK (
  created_by = auth.uid() AND
  is_internal_conversation_participant(conversation_id)
);

CREATE POLICY "Creators can update their polls"
ON public.internal_polls FOR UPDATE
USING (created_by = auth.uid());

CREATE POLICY "Creators can delete their polls"
ON public.internal_polls FOR DELETE
USING (created_by = auth.uid());

-- RLS policies for votes
CREATE POLICY "Users can view votes in their conversation polls"
ON public.internal_poll_votes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.internal_polls p
    WHERE p.id = poll_id AND is_internal_conversation_participant(p.conversation_id)
  )
);

CREATE POLICY "Users can vote in polls"
ON public.internal_poll_votes FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.internal_polls p
    WHERE p.id = poll_id 
    AND is_internal_conversation_participant(p.conversation_id)
    AND p.is_closed = false
  )
);

CREATE POLICY "Users can remove their votes"
ON public.internal_poll_votes FOR DELETE
USING (user_id = auth.uid());

-- Enable realtime for polls
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_poll_votes;

-- Indexes
CREATE INDEX idx_internal_polls_conversation ON public.internal_polls(conversation_id);
CREATE INDEX idx_internal_poll_votes_poll ON public.internal_poll_votes(poll_id);
CREATE INDEX idx_internal_poll_votes_user ON public.internal_poll_votes(user_id);