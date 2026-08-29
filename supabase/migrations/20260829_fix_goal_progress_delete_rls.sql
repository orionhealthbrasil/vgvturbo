-- goal_progress só tinha policy de SELECT. Sem policy de DELETE/UPDATE/INSERT,
-- o RLS bloqueia o ON DELETE CASCADE disparado ao excluir uma meta, e isso
-- quebra o DELETE em public.goals com uma violação de foreign key.
CREATE POLICY "Manage progress" ON public.goal_progress FOR ALL
  USING (EXISTS (SELECT 1 FROM public.goals g JOIN public.organization_members om
    ON om.organization_id = g.organization_id WHERE g.id = goal_id
    AND om.user_id = auth.uid() AND om.role IN ('owner','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.goals g JOIN public.organization_members om
    ON om.organization_id = g.organization_id WHERE g.id = goal_id
    AND om.user_id = auth.uid() AND om.role IN ('owner','admin')));
