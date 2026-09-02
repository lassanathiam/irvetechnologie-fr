CREATE TABLE public.demande_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demande_id uuid NOT NULL REFERENCES public.demande_requests(id) ON DELETE CASCADE,
  kind text NOT NULL,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX demande_photos_demande_id_idx ON public.demande_photos(demande_id);
GRANT SELECT ON public.demande_photos TO authenticated;
GRANT ALL ON public.demande_photos TO service_role;
ALTER TABLE public.demande_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read demande photos" ON public.demande_photos FOR SELECT TO authenticated USING (true);

GRANT SELECT, UPDATE ON public.demande_requests TO authenticated;
CREATE POLICY "Staff can read demandes" ON public.demande_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can update demandes" ON public.demande_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Staff can read demande photo files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'demande-photos');

CREATE TABLE public.rapports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'conformite',
  date_intervention date NOT NULL DEFAULT current_date,
  client_nom text NOT NULL,
  client_telephone text,
  client_email text,
  chantier_adresse text,
  chantier_cp_ville text,
  borne_marque text,
  borne_modele text,
  borne_puissance text,
  borne_serie text,
  technicien text,
  mesures jsonb NOT NULL DEFAULT '{}'::jsonb,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  observations text,
  reserves text,
  signature_technicien text,
  signature_client text,
  signataire_client text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapports TO authenticated;
GRANT ALL ON public.rapports TO service_role;
ALTER TABLE public.rapports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage rapports" ON public.rapports FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_rapports_updated_at BEFORE UPDATE ON public.rapports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();