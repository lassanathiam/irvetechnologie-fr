ALTER TABLE public.partenaires
  ADD COLUMN IF NOT EXISTS delai_paiement_jours integer NOT NULL DEFAULT 30;

ALTER TABLE public.rendezvous
  ADD COLUMN IF NOT EXISTS delai_paiement_jours integer,
  ADD COLUMN IF NOT EXISTS echeance_paiement date,
  ADD COLUMN IF NOT EXISTS facture_envoyee_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS paye_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS montant_propose_ht numeric,
  ADD COLUMN IF NOT EXISTS montant_propose_note text,
  ADD COLUMN IF NOT EXISTS montant_propose_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS montant_propose_par text,
  ADD COLUMN IF NOT EXISTS montant_valide_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS rendezvous_echeance_paiement_idx
  ON public.rendezvous (echeance_paiement)
  WHERE echeance_paiement IS NOT NULL;