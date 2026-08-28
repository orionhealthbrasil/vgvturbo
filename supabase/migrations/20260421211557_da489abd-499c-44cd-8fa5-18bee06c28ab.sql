-- Tabela principal de metas
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('revenue','deals_count','conversion_rate')),
  scope TEXT NOT NULL CHECK (scope IN ('individual','team','group')),
  target_value NUMERIC NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily','weekly','monthly','quarterly','yearly','custom')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  pipeline_id UUID REFERENCES public.kanban_pipelines(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived','failed')),
  created_by UUID NOT NULL,
  notified_50 BOOLEAN NOT NULL DEFAULT false,
  notified_80 BOOLEAN NOT NULL DEFAULT false,
  notified_100 BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.goal_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(goal_id, user_id)
);

CREATE TABLE public.goal_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID,
  current_value NUMERIC NOT NULL DEFAULT 0,
  deals_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(goal_id, user_id)
);

CREATE INDEX idx_goals_org_status ON public.goals(organization_id, status);
CREATE INDEX idx_goals_period ON public.goals(organization_id, period_start, period_end);
CREATE INDEX idx_goal_participants_user ON public.goal_participants(user_id);
CREATE INDEX idx_goal_progress_goal ON public.goal_progress(goal_id);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view goals" ON public.goals FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Owners/admins manage goals" ON public.goals FOR ALL
  USING (EXISTS (SELECT 1 FROM public.organization_members om
    WHERE om.user_id=auth.uid() AND om.organization_id=goals.organization_id
    AND om.role IN ('owner','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members om
    WHERE om.user_id=auth.uid() AND om.organization_id=goals.organization_id
    AND om.role IN ('owner','admin')));

CREATE POLICY "View participants" ON public.goal_participants FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.goals g WHERE g.id=goal_id
    AND public.user_belongs_to_org(auth.uid(), g.organization_id)));
CREATE POLICY "Manage participants" ON public.goal_participants FOR ALL
  USING (EXISTS (SELECT 1 FROM public.goals g JOIN public.organization_members om
    ON om.organization_id=g.organization_id WHERE g.id=goal_id
    AND om.user_id=auth.uid() AND om.role IN ('owner','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.goals g JOIN public.organization_members om
    ON om.organization_id=g.organization_id WHERE g.id=goal_id
    AND om.user_id=auth.uid() AND om.role IN ('owner','admin')));

CREATE POLICY "View progress" ON public.goal_progress FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.goals g WHERE g.id=goal_id
    AND public.user_belongs_to_org(auth.uid(), g.organization_id)));

CREATE OR REPLACE FUNCTION public.recalculate_goal_progress(p_goal_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  g RECORD;
  v_won_count INT;
  v_total_count INT;
  v_revenue NUMERIC;
BEGIN
  SELECT * INTO g FROM goals WHERE id=p_goal_id;
  IF NOT FOUND OR g.status<>'active' THEN RETURN; END IF;

  DELETE FROM goal_progress WHERE goal_id=p_goal_id;

  SELECT
    COALESCE(SUM(CASE WHEN c.sale_result='won' THEN c.deal_value ELSE 0 END),0),
    COUNT(*) FILTER (WHERE c.sale_result='won'),
    COUNT(*) FILTER (WHERE c.sale_result IS NOT NULL)
  INTO v_revenue, v_won_count, v_total_count
  FROM contacts c
  WHERE c.organization_id=g.organization_id
    AND c.closed_at::date BETWEEN g.period_start AND g.period_end
    AND (g.pipeline_id IS NULL OR c.pipeline_id=g.pipeline_id)
    AND (g.scope='team' OR c.assigned_to IN (
      SELECT user_id FROM goal_participants WHERE goal_id=p_goal_id
    ));

  INSERT INTO goal_progress (goal_id, user_id, current_value, deals_count)
  VALUES (p_goal_id, NULL,
    CASE g.goal_type
      WHEN 'revenue' THEN v_revenue
      WHEN 'deals_count' THEN v_won_count
      WHEN 'conversion_rate' THEN CASE WHEN v_total_count>0 THEN (v_won_count::numeric/v_total_count*100) ELSE 0 END
    END,
    v_won_count);

  IF g.scope IN ('individual','group') THEN
    INSERT INTO goal_progress (goal_id, user_id, current_value, deals_count)
    SELECT p_goal_id, gp.user_id,
      CASE g.goal_type
        WHEN 'revenue' THEN COALESCE(SUM(CASE WHEN c.sale_result='won' THEN c.deal_value END),0)
        WHEN 'deals_count' THEN COUNT(*) FILTER (WHERE c.sale_result='won')
        WHEN 'conversion_rate' THEN
          CASE WHEN COUNT(*) FILTER (WHERE c.sale_result IS NOT NULL)>0
            THEN COUNT(*) FILTER (WHERE c.sale_result='won')::numeric
              / COUNT(*) FILTER (WHERE c.sale_result IS NOT NULL)*100
            ELSE 0 END
      END,
      COUNT(*) FILTER (WHERE c.sale_result='won')
    FROM goal_participants gp
    LEFT JOIN contacts c ON c.assigned_to=gp.user_id
      AND c.organization_id=g.organization_id
      AND c.closed_at::date BETWEEN g.period_start AND g.period_end
      AND (g.pipeline_id IS NULL OR c.pipeline_id=g.pipeline_id)
    WHERE gp.goal_id=p_goal_id
    GROUP BY gp.user_id;
  END IF;

  UPDATE goals SET status='completed', updated_at=now()
  WHERE id=p_goal_id AND status='active'
    AND EXISTS(SELECT 1 FROM goal_progress
      WHERE goal_id=p_goal_id AND user_id IS NULL AND current_value>=g.target_value);
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_goal_recalc_on_contact()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE g_id UUID;
BEGIN
  IF (TG_OP='UPDATE' AND
      (OLD.sale_result IS DISTINCT FROM NEW.sale_result
       OR OLD.deal_value IS DISTINCT FROM NEW.deal_value
       OR OLD.closed_at IS DISTINCT FROM NEW.closed_at
       OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to))
     OR TG_OP='INSERT' THEN
    FOR g_id IN
      SELECT id FROM goals
      WHERE organization_id=NEW.organization_id
        AND status='active'
        AND COALESCE(NEW.closed_at::date, CURRENT_DATE) BETWEEN period_start AND period_end
    LOOP
      PERFORM recalculate_goal_progress(g_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER contacts_goal_recalc
AFTER INSERT OR UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.trigger_goal_recalc_on_contact();

ALTER PUBLICATION supabase_realtime ADD TABLE public.goals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.goal_progress;

-- Trigger updated_at
CREATE TRIGGER set_goals_updated_at BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();