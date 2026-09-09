ALTER TABLE public.rendezvous_photos ADD COLUMN IF NOT EXISTS categorie text NOT NULL DEFAULT 'autre';
ALTER TABLE public.rendezvous ADD COLUMN IF NOT EXISTS materiel_statut text NOT NULL DEFAULT 'en_cours';
ALTER TABLE public.rendezvous ADD COLUMN IF NOT EXISTS materiel_maj_at timestamptz;
CREATE INDEX IF NOT EXISTS rendezvous_photos_categorie_idx ON public.rendezvous_photos (rendezvous_id, categorie);