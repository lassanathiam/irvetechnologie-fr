ALTER TABLE public.attachements_travaux DROP CONSTRAINT IF EXISTS attachements_travaux_statut_check;
ALTER TABLE public.attachements_travaux ADD CONSTRAINT attachements_travaux_statut_check
  CHECK (statut = ANY (ARRAY['brouillon','envoye','propose','accepte','refuse','facture','annule']));