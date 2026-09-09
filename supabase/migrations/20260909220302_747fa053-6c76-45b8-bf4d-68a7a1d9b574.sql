ALTER TABLE public.demande_requests
  ADD COLUMN IF NOT EXISTS type_demande text NOT NULL DEFAULT 'raccordement',
  ADD COLUMN IF NOT EXISTS nb_bornes integer;