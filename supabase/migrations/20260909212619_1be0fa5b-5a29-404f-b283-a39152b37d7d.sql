CREATE POLICY "Staff read chantier photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chantier-photos');

CREATE POLICY "Staff insert chantier photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chantier-photos');

CREATE POLICY "Staff delete chantier photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chantier-photos');