ALTER TABLE public.rendezvous
  ADD COLUMN IF NOT EXISTS demarre_at timestamptz,
  ADD COLUMN IF NOT EXISTS termine_at timestamptz,
  ADD COLUMN IF NOT EXISTS notif_fin_at timestamptz;

ALTER TABLE public.partenaires
  ADD COLUMN IF NOT EXISTS couleur text NOT NULL DEFAULT '#0284c7';

CREATE INDEX IF NOT EXISTS rendezvous_demarre_idx ON public.rendezvous (demarre_at) WHERE demarre_at IS NOT NULL;