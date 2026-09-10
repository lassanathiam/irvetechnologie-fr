ALTER TABLE public.rendezvous
  ADD COLUMN IF NOT EXISTS metrage_inclus_m numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS metrage_reel_m numeric,
  ADD COLUMN IF NOT EXISTS retour_observations text,
  ADD COLUMN IF NOT EXISTS retour_delestage boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retour_complete_at timestamptz;