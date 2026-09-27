ALTER TABLE public.partenaires
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'donneur_ordre',
  ADD COLUMN IF NOT EXISTS base_adresse text,
  ADD COLUMN IF NOT EXISTS base_lat numeric,
  ADD COLUMN IF NOT EXISTS base_lng numeric;
ALTER TABLE public.partenaires DROP CONSTRAINT IF EXISTS partenaires_type_check;
ALTER TABLE public.partenaires ADD CONSTRAINT partenaires_type_check CHECK (type IN ('donneur_ordre','sous_traitant'));
ALTER TABLE public.rendezvous
  ADD COLUMN IF NOT EXISTS sous_traitant_id uuid REFERENCES public.partenaires(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS montant_sous_traitant_ht numeric;
CREATE INDEX IF NOT EXISTS rendezvous_sous_traitant_idx ON public.rendezvous(sous_traitant_id);