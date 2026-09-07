ALTER TABLE public.demande_requests
  ADD COLUMN IF NOT EXISTS abonnement_kva text,
  ADD COLUMN IF NOT EXISTS type_compteur text,
  ADD COLUMN IF NOT EXISTS phase text;

ALTER TABLE public.rapports
  ADD COLUMN IF NOT EXISTS devis_id uuid REFERENCES public.devis(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rendezvous_id uuid REFERENCES public.rendezvous(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS typologie jsonb NOT NULL DEFAULT '{}'::jsonb;