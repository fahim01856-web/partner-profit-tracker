
DROP POLICY IF EXISTS "auth all kyc_checklist" ON public.kyc_checklist_items;
CREATE POLICY "admin all kyc_checklist_items" ON public.kyc_checklist_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth all kyc_documents" ON public.kyc_documents;
CREATE POLICY "admin all kyc_documents" ON public.kyc_documents FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth all kyc_profiles" ON public.kyc_profiles;
CREATE POLICY "admin all kyc_profiles" ON public.kyc_profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth all meetings" ON public.meetings;
CREATE POLICY "admin all meetings" ON public.meetings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth all meeting_agendas" ON public.meeting_agendas;
CREATE POLICY "admin all meeting_agendas" ON public.meeting_agendas FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth all meeting_attendees" ON public.meeting_attendees;
CREATE POLICY "admin all meeting_attendees" ON public.meeting_attendees FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth all meeting_actions" ON public.meeting_actions;
CREATE POLICY "admin all meeting_actions" ON public.meeting_actions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth all meeting_targets" ON public.meeting_targets;
CREATE POLICY "admin all meeting_targets" ON public.meeting_targets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth all meeting_problems" ON public.meeting_problems;
CREATE POLICY "admin all meeting_problems" ON public.meeting_problems FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth all tasks" ON public.tasks;
CREATE POLICY "admin all tasks" ON public.tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth all task_history" ON public.task_history;
CREATE POLICY "admin all task_history" ON public.task_history FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
