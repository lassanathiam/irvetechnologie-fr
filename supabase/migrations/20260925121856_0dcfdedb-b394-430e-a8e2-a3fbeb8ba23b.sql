ALTER TABLE public.rendezvous
  ADD COLUMN IF NOT EXISTS nature_dossier text,
  ADD COLUMN IF NOT EXISTS materiel_fourni jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.rendezvous ADD CONSTRAINT rendezvous_nature_dossier_check
  CHECK (nature_dossier IS NULL OR nature_dossier IN ('installation','remplacement','maintenance'));