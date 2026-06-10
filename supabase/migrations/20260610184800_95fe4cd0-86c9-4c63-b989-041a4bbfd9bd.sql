DROP POLICY IF EXISTS "Authenticated can manage pending categories" ON public.pending_categories;

CREATE POLICY "Authenticated can read pending categories"
  ON public.pending_categories FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert pending categories"
  ON public.pending_categories FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update pending categories"
  ON public.pending_categories FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pending categories"
  ON public.pending_categories FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));