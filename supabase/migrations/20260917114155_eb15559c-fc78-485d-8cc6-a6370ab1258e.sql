ALTER TABLE public.attachements_travaux ADD COLUMN IF NOT EXISTS proposition_autorisee boolean NOT NULL DEFAULT true;

CREATE TABLE public.attachement_propositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attachement_id uuid NOT NULL REFERENCES public.attachements_travaux(id) ON DELETE CASCADE,
  signataire_nom text NOT NULL,
  commentaire text,
  total_ht numeric NOT NULL DEFAULT 0,
  statut text NOT NULL DEFAULT 'en_attente',
  lignes jsonb NOT NULL DEFAULT '[]'::jsonb,
  traite_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachement_propositions TO authenticated;
GRANT ALL ON public.attachement_propositions TO service_role;

ALTER TABLE public.attachement_propositions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage attachement propositions"
ON public.attachement_propositions FOR ALL TO authenticated
USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE INDEX idx_attachement_propositions_attachement ON public.attachement_propositions(attachement_id, statut);

CREATE TRIGGER update_attachement_propositions_updated_at
BEFORE UPDATE ON public.attachement_propositions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();