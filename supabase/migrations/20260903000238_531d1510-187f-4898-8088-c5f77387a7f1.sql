-- demande_rate_limits reste strictement backend-only : aucune ligne accessible via l'API
CREATE POLICY "no client access to rate limits"
ON public.demande_rate_limits
FOR SELECT
TO anon, authenticated
USING (false);