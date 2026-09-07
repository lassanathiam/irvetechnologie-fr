CREATE TABLE public.partenaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  actif boolean NOT NULL DEFAULT true,
  notes text,
  owner_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX partenaires_token_key ON public.partenaires (token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partenaires TO authenticated;
GRANT ALL ON public.partenaires TO service_role;

ALTER TABLE public.partenaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage partenaires" ON public.partenaires
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_partenaires_updated_at
  BEFORE UPDATE ON public.partenaires
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.rendezvous
  ADD COLUMN partenaire_id uuid REFERENCES public.partenaires(id) ON DELETE SET NULL,
  ADD COLUMN date_a_confirmer boolean NOT NULL DEFAULT false;

CREATE INDEX rendezvous_partenaire_id_idx ON public.rendezvous (partenaire_id);