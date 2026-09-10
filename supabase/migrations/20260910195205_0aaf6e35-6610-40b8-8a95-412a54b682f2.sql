ALTER TABLE public.partenaires
  ADD COLUMN IF NOT EXISTS raison_sociale text,
  ADD COLUMN IF NOT EXISTS adresse text,
  ADD COLUMN IF NOT EXISTS cp_ville text,
  ADD COLUMN IF NOT EXISTS pays text NOT NULL DEFAULT 'France',
  ADD COLUMN IF NOT EXISTS siret text,
  ADD COLUMN IF NOT EXISTS tva_intracom text,
  ADD COLUMN IF NOT EXISTS contact_nom text,
  ADD COLUMN IF NOT EXISTS telephone text;