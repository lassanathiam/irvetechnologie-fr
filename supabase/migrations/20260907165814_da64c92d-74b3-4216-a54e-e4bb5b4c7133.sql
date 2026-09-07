ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS rendezvous_id uuid REFERENCES public.rendezvous(id) ON DELETE SET NULL;

ALTER TABLE public.rendezvous
  ADD COLUMN IF NOT EXISTS chantier_valide boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chantier_valide_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS chantier_valide_par text,
  ADD COLUMN IF NOT EXISTS chantier_commentaire text;

CREATE TABLE IF NOT EXISTS public.voirie_autorisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rendezvous_id uuid NOT NULL REFERENCES public.rendezvous(id) ON DELETE CASCADE,
  statut text NOT NULL DEFAULT 'en_attente',
  reference text,
  autorite text,
  date_demande date,
  date_obtention date,
  date_fin date,
  document_path text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voirie_autorisations TO authenticated;
GRANT ALL ON public.voirie_autorisations TO service_role;

ALTER TABLE public.voirie_autorisations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage voirie" ON public.voirie_autorisations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_voirie_updated_at BEFORE UPDATE ON public.voirie_autorisations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS voirie_rendezvous_idx ON public.voirie_autorisations(rendezvous_id);
CREATE INDEX IF NOT EXISTS devis_rendezvous_idx ON public.devis(rendezvous_id);