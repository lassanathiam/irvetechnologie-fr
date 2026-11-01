ALTER TABLE public.attachements_travaux
  ADD COLUMN IF NOT EXISTS depose_at timestamptz,
  ADD COLUMN IF NOT EXISTS envoye_facturation_at timestamptz,
  ADD COLUMN IF NOT EXISTS paye_at timestamptz;