CREATE TABLE public.demande_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_demande_rate_limits_ip_created ON public.demande_rate_limits(ip, created_at DESC);

GRANT ALL ON public.demande_rate_limits TO service_role;

ALTER TABLE public.demande_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only"
  ON public.demande_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);