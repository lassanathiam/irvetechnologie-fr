ALTER TABLE public.demande_requests
  ADD COLUMN IF NOT EXISTS profil_client text,
  ADD COLUMN IF NOT EXISTS secteur_pro text,
  ADD COLUMN IF NOT EXISTS lead_source text,
  ADD COLUMN IF NOT EXISTS lead_campagne text,
  ADD COLUMN IF NOT EXISTS page_origine text,
  ADD COLUMN IF NOT EXISTS relance_le date,
  ADD COLUMN IF NOT EXISTS note_suivi text;