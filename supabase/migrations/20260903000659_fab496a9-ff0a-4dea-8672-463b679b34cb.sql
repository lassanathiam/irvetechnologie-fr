CREATE TABLE public.rendezvous (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  demande_id uuid REFERENCES public.demande_requests(id) ON DELETE SET NULL,
  titre text NOT NULL,
  type text NOT NULL DEFAULT 'installation',
  statut text NOT NULL DEFAULT 'planifie',
  client_nom text NOT NULL,
  client_telephone text,
  client_email text,
  adresse text NOT NULL,
  cp_ville text,
  lat numeric,
  lng numeric,
  distance_km numeric,
  duree_trajet_min integer,
  date_debut timestamptz NOT NULL,
  duree_min integer NOT NULL DEFAULT 120,
  technicien text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rendezvous TO authenticated;
GRANT ALL ON public.rendezvous TO service_role;

ALTER TABLE public.rendezvous ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage rendezvous"
ON public.rendezvous FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX rendezvous_date_idx ON public.rendezvous (date_debut);

CREATE TRIGGER rendezvous_updated_at
BEFORE UPDATE ON public.rendezvous
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();