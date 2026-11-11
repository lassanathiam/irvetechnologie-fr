CREATE TABLE public.prospects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 entreprise text NOT NULL,
 metier text NOT NULL DEFAULT 'bornes' CHECK (metier IN ('bornes','fibre')),
 cible text,
 ville text,
 departement text,
 site_web text,
 email text,
 formulaire_url text,
 telephone text,
 source_url text,
 pourquoi text,
 inconnu text,
 objet_mail text,
 corps_mail text,
 statut text NOT NULL DEFAULT 'a_envoyer' CHECK (statut IN ('a_envoyer','envoye','relance','repondu','interesse','pas_interesse','stop')),
 envoye_le timestamptz,
 relance_le date,
 notes text,
 lot text,
 created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospects TO authenticated;
GRANT ALL ON public.prospects TO service_role;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe gere les prospects" ON public.prospects FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE UNIQUE INDEX prospects_entreprise_ville_unique ON public.prospects (lower(entreprise), lower(coalesce(ville,'')));
CREATE TRIGGER prospects_updated BEFORE UPDATE ON public.prospects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();