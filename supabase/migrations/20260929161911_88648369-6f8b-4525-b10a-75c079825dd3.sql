DROP POLICY "Staff can delete demandes" ON public.demande_requests;
DROP POLICY "Staff can update demandes" ON public.demande_requests;
DROP POLICY "Staff can read demandes" ON public.demande_requests;
CREATE POLICY "Staff can delete demandes" ON public.demande_requests FOR DELETE TO authenticated USING (public.is_staff());
CREATE POLICY "Staff can update demandes" ON public.demande_requests FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Staff can read demandes" ON public.demande_requests FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY "Staff can delete demande photos" ON public.demande_photos;
DROP POLICY "Staff can read demande photos" ON public.demande_photos;
CREATE POLICY "Staff can delete demande photos" ON public.demande_photos FOR DELETE TO authenticated USING (public.is_staff());
CREATE POLICY "Staff can read demande photos" ON public.demande_photos FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY "Staff can manage bornes" ON public.bornes;
CREATE POLICY "Staff can manage bornes" ON public.bornes FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY "Authenticated can read prestations" ON public.prestations;
CREATE POLICY "Staff can read prestations" ON public.prestations FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY "Utilisateurs connectes gerent les realisations" ON public.realisations;
CREATE POLICY "Staff gerent les realisations" ON public.realisations FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY "Staff can read borne photos" ON storage.objects;
DROP POLICY "Staff can delete borne photos" ON storage.objects;
DROP POLICY "Staff can update borne photos" ON storage.objects;
DROP POLICY "Staff can upload borne photos" ON storage.objects;
CREATE POLICY "Staff can read borne photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'borne-photos' AND public.is_staff());
CREATE POLICY "Staff can delete borne photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'borne-photos' AND public.is_staff());
CREATE POLICY "Staff can update borne photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'borne-photos' AND public.is_staff()) WITH CHECK (bucket_id = 'borne-photos' AND public.is_staff());
CREATE POLICY "Staff can upload borne photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'borne-photos' AND public.is_staff());