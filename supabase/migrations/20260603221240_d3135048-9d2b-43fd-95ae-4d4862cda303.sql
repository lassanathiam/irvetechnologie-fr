CREATE TABLE public.demande_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  email TEXT NOT NULL,
  telephone TEXT NOT NULL,
  code_postal TEXT NOT NULL,
  type_bien TEXT,
  puissance TEXT,
  type_installation TEXT,
  distance_m INTEGER,
  notes TEXT,
  formule TEXT,
  status TEXT NOT NULL DEFAULT 'nouveau',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.demande_requests TO anon;
GRANT INSERT ON public.demande_requests TO authenticated;
GRANT ALL ON public.demande_requests TO service_role;

ALTER TABLE public.demande_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a demande"
  ON public.demande_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_demande_requests_updated_at
  BEFORE UPDATE ON public.demande_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();