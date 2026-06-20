
-- Restrict application module tables to admins
DROP POLICY IF EXISTS "auth manage attachments" ON public.application_attachments;
CREATE POLICY "admin manage attachments" ON public.application_attachments FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "auth manage fields" ON public.application_fields;
CREATE POLICY "admin manage fields" ON public.application_fields FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "auth manage history" ON public.application_history;
CREATE POLICY "admin manage history" ON public.application_history FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "auth manage records" ON public.application_records;
CREATE POLICY "admin manage records" ON public.application_records FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "auth manage templates" ON public.application_templates;
CREATE POLICY "admin manage templates" ON public.application_templates FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "auth manage activities" ON public.application_user_activities;
CREATE POLICY "admin manage activities" ON public.application_user_activities FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "auth manage approvals" ON public.approval_records;
CREATE POLICY "admin manage approvals" ON public.approval_records FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "auth manage cust docs" ON public.customer_documents;
CREATE POLICY "admin manage cust docs" ON public.customer_documents FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can manage tin_ereturns" ON public.tin_ereturns;
CREATE POLICY "admin manage tin_ereturns" ON public.tin_ereturns FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket policies for application-attachments → admin only
DROP POLICY IF EXISTS "auth read app attachments bucket" ON storage.objects;
DROP POLICY IF EXISTS "auth upload app attachments bucket" ON storage.objects;
DROP POLICY IF EXISTS "auth update app attachments bucket" ON storage.objects;
DROP POLICY IF EXISTS "auth delete app attachments bucket" ON storage.objects;

CREATE POLICY "app_attachments_admin_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'application-attachments' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "app_attachments_admin_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'application-attachments' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "app_attachments_admin_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'application-attachments' AND has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (bucket_id = 'application-attachments' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "app_attachments_admin_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'application-attachments' AND has_role(auth.uid(), 'admin'::app_role));
