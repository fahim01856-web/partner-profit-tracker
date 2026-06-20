
-- Restrict agent_bank_assets, task_comments, task_templates to admins only
DROP POLICY IF EXISTS "Authenticated can view assets" ON public.agent_bank_assets;
DROP POLICY IF EXISTS "Authenticated can insert assets" ON public.agent_bank_assets;
DROP POLICY IF EXISTS "Authenticated can update assets" ON public.agent_bank_assets;
DROP POLICY IF EXISTS "Authenticated can delete assets" ON public.agent_bank_assets;

CREATE POLICY "Admins manage assets" ON public.agent_bank_assets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "task_comments_all_auth" ON public.task_comments;
CREATE POLICY "Admins manage task comments" ON public.task_comments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "task_templates_all_auth" ON public.task_templates;
CREATE POLICY "Admins manage task templates" ON public.task_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
