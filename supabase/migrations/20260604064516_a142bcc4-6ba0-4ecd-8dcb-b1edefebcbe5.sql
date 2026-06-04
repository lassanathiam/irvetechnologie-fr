-- Allow public form submissions while keeping reads/updates/deletes restricted to service_role
CREATE POLICY "Anyone can submit a demande"
  ON public.demande_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

GRANT INSERT ON public.demande_requests TO anon, authenticated;