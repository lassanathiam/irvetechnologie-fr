CREATE POLICY "Staff read voirie docs" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'voirie-docs');
CREATE POLICY "Staff insert voirie docs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'voirie-docs');
CREATE POLICY "Staff update voirie docs" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'voirie-docs') WITH CHECK (bucket_id = 'voirie-docs');
CREATE POLICY "Staff delete voirie docs" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'voirie-docs');