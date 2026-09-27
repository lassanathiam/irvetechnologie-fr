CREATE TABLE public.rapport_modeles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  donneur_ordre text NOT NULL,
  logo_data text,
  email_destinataire text,
  structure jsonb NOT NULL DEFAULT '{"sections":[]}'::jsonb,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapport_modeles TO authenticated;
GRANT ALL ON public.rapport_modeles TO service_role;
ALTER TABLE public.rapport_modeles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff gère les modèles" ON public.rapport_modeles FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE TRIGGER update_rapport_modeles_updated_at BEFORE UPDATE ON public.rapport_modeles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.rapport_remplis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modele_id uuid NOT NULL REFERENCES public.rapport_modeles(id) ON DELETE CASCADE,
  rendezvous_id uuid REFERENCES public.rendezvous(id) ON DELETE SET NULL,
  valeurs jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_client text,
  signature_technicien text,
  signataire_nom text,
  technicien text,
  signed_at timestamptz,
  sent_at timestamptz,
  sent_to text,
  public_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapport_remplis TO authenticated;
GRANT ALL ON public.rapport_remplis TO service_role;
ALTER TABLE public.rapport_remplis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff gère les rapports remplis" ON public.rapport_remplis FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE TRIGGER update_rapport_remplis_updated_at BEFORE UPDATE ON public.rapport_remplis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX rapport_remplis_rdv_idx ON public.rapport_remplis(rendezvous_id);