DROP POLICY IF EXISTS "Anyone can submit a demande" ON public.demande_requests;
REVOKE INSERT ON public.demande_requests FROM anon;
REVOKE INSERT ON public.demande_requests FROM authenticated;