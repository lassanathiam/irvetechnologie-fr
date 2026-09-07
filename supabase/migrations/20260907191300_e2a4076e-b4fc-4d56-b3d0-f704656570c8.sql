ALTER TABLE public.rendezvous
  ADD COLUMN IF NOT EXISTS origine text NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS partenaire text,
  ADD COLUMN IF NOT EXISTS montant_ht numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tva_pct numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS statut_facturation text NOT NULL DEFAULT 'a_facturer';

ALTER TABLE public.rendezvous
  ADD CONSTRAINT rendezvous_origine_check CHECK (origine IN ('direct','sous_traitance')),
  ADD CONSTRAINT rendezvous_statut_facturation_check CHECK (statut_facturation IN ('a_facturer','facture','paye'));